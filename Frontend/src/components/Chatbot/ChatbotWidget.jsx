import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMessageSquare, FiX, FiSend, FiChevronDown } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

// Auth/onboarding paths where the chatbot should NOT appear
const AUTH_ROUTE_PATTERNS = [
    /\/(login|signin|sign-in)(\/?$|\/)/i,
    /\/(register|signup|sign-up)(\/?$|\/)/i,
    /\/otp(\/?$|\/)/i,
    /\/auth(\/?$|\/)/i,
    /\/welcome(\/?$|\/)/i,
    /\/onboarding(\/?$|\/)/i,
    /\/pending(\/?$|\/)/i,
    /\/verification(\/?$|\/)/i,
    /\/forgot-password(\/?$|\/)/i,
    /\/reset-password(\/?$|\/)/i,
];

const isAuthPath = (pathname) =>
    AUTH_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

// Assuming the API is at VITE_API_BASE_URL
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Resolve the active user ID:
// 1. Prefer the real logged-in user's MongoDB _id from localStorage based on module
// 2. Fall back to a persistent guest hex-id
const getActiveUserId = (module) => {
    try {
        let userStr = null;
        if (module === 'restaurant') {
            userStr = localStorage.getItem('restaurant_user');
        } else if (module === 'seller') {
            userStr = localStorage.getItem('seller_user') || localStorage.getItem('seller');
        } else if (module === 'delivery') {
            userStr = localStorage.getItem('delivery_user');
        } else {
            userStr = localStorage.getItem('user_user') || localStorage.getItem('user');
        }
        
        if (userStr) {
            const user = JSON.parse(userStr);
            const id = user?._id || user?.id;
            if (id) return id;
        }
    } catch (_) {}

    // Guest fallback: generate a valid 24-char hex id once
    let guestId = localStorage.getItem('chatbot_guest_id');
    if (!guestId) {
        guestId = [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        localStorage.setItem('chatbot_guest_id', guestId);
    }
    return guestId;
};

const ChatbotWidget = ({ userId, module = 'user' }) => {
    const location = useLocation();
    const activeUserId = userId || getActiveUserId(module);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [options, setOptions] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const [dragConstraints, setDragConstraints] = useState({ left: -800, right: 0, top: -800, bottom: 0 });

    // Calculate drag constraints dynamically based on window size and position
    useEffect(() => {
        const updateConstraints = () => {
            if (typeof window !== 'undefined') {
                const isUserPanel = module === 'user';
                // Button is 56x56 (w-14 h-14). 
                // If user panel: Position is left-6 (24px), bottom-24 (96px).
                // If restaurant: Position is right-6 (24px), bottom-24 (96px).
                setDragConstraints({
                    left: isUserPanel ? 0 : -(window.innerWidth - 56 - 24),
                    right: isUserPanel ? (window.innerWidth - 56 - 24) : 0,
                    top: -(window.innerHeight - 56 - 96),
                    bottom: 72 // Allows dragging it 72px down to the corner if they really want to (96-24=72)
                });
            }
        };
        updateConstraints();
        window.addEventListener('resize', updateConstraints);
        return () => window.removeEventListener('resize', updateConstraints);
    }, []);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // Prevent background scrolling when chatbot is open
    useEffect(() => {
        const preventDefault = (e) => {
            const chatbotModal = document.getElementById('chatbot-modal-content');
            // If the event target is inside the chatbot, allow it
            if (chatbotModal && chatbotModal.contains(e.target)) {
                // Stop it from reaching other window listeners, but don't preventDefault so native scroll works
                e.stopImmediatePropagation();
                return;
            }
            // Otherwise, block it completely (stops Lenis and native scrolling)
            e.preventDefault();
            e.stopImmediatePropagation();
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Add non-passive event listeners to window to intercept scroll events before Lenis gets them
            window.addEventListener('wheel', preventDefault, { passive: false, capture: true });
            window.addEventListener('touchmove', preventDefault, { passive: false, capture: true });

            let style = document.getElementById('chatbot-scroll-lock');
            if (!style) {
                style = document.createElement('style');
                style.id = 'chatbot-scroll-lock';
                style.innerHTML = `
                    body, 
                    .overflow-y-auto:not(#chatbot-messages), 
                    .overflow-x-auto:not(#chatbot-messages), 
                    .overflow-auto:not(#chatbot-messages) {
                        overflow: hidden !important;
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            document.body.style.overflow = 'unset';
            window.removeEventListener('wheel', preventDefault, { capture: true });
            window.removeEventListener('touchmove', preventDefault, { capture: true });

            const style = document.getElementById('chatbot-scroll-lock');
            if (style) style.remove();
        }
        
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('wheel', preventDefault, { capture: true });
            window.removeEventListener('touchmove', preventDefault, { capture: true });

            const style = document.getElementById('chatbot-scroll-lock');
            if (style) style.remove();
        };
    }, [isOpen]);

    // Fetch initial session when opened for the first time
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            fetchSession();
        }
    }, [isOpen]);

    const fetchSession = async () => {
        try {
            setIsLoading(true);
            const res = await axios.get(`${API_URL}/chat/session/${activeUserId}?module=${module}`);
            if (res.data.success) {
                setMessages(res.data.data.messages);
                setOptions(res.data.data.currentOptions);
            }
        } catch (error) {
            console.error('Error fetching chat session:', error);
            setMessages([{ sender: 'bot', text: 'Sorry, I am currently unavailable.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (text, nodeId = null, action = null) => {
        if (!text.trim() && !nodeId) return;

        // Optimistically add user message if it's text
        if (text) {
            setMessages((prev) => [...prev, { sender: 'user', text }]);
            setInputText('');
        }

        setIsLoading(true);
        setOptions([]); // Clear options while loading

        try {
            const res = await axios.post(`${API_URL}/chat/message`, {
                userId: activeUserId,
                message: text,
                nodeId,
                action,
                module: module
            });

            if (res.data.success) {
                setMessages((prev) => [
                    ...prev,
                    { sender: 'bot', text: res.data.data.message }
                ]);
                setOptions(res.data.data.options || []);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => [
                ...prev,
                { sender: 'bot', text: 'Something went wrong. Please try again.' }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionClick = (option) => {
        // Option objects have { text, nextNodeId, action }
        handleSendMessage(option.text, option.nextNodeId, option.action);
    };
    // Do not render the chatbot on auth/login/onboarding pages (all panels)
    if (isAuthPath(location.pathname)) return null;

    return (
        <>
            {/* The Chat Window (Centered) */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop to prevent interaction and scrolling of the background */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-[95] bg-black/20 backdrop-blur-sm"
                            style={{ touchAction: 'none' }}
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                        />
                        <motion.div
                            id="chatbot-modal-content"
                            data-lenis-prevent="true"
                            initial={{ opacity: 0, scale: 0.8, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 50 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="fixed inset-0 m-auto z-[100] bg-white rounded-2xl shadow-2xl w-[350px] h-[550px] flex flex-col overflow-hidden border border-gray-100"
                        >
                            {/* Header */}
                        <div className="bg-primary text-white p-4 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-lg">Dukaanwallah Help</h3>
                                <p className="text-xs opacity-80">Instant Automated Support</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <FiChevronDown size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div id="chatbot-messages" data-lenis-prevent="true" className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: msg.sender === 'user' ? 10 : -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                            msg.sender === 'user'
                                                ? 'bg-primary text-white rounded-tr-sm'
                                                : 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-sm'
                                        }`}
                                    >
                                        {msg.text.split('\n').map((line, i) => (
                                            <p key={i} className="mb-1 last:mb-0">{line}</p>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                            
                            {/* Loading Indicator */}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-1">
                                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                    </div>
                                </div>
                            )}

                            {/* Quick Options */}
                            {!isLoading && options && options.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {options.map((opt, idx) => (
                                        <motion.button
                                            key={idx}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            onClick={() => handleOptionClick(opt)}
                                            className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                                        >
                                            {opt.text}
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                                placeholder="Type a message..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            <button
                                onClick={() => handleSendMessage(inputText)}
                                disabled={!inputText.trim() || isLoading}
                                className="p-2 bg-primary text-white rounded-full disabled:opacity-50 hover:bg-primary/90 transition-colors"
                            >
                                <FiSend size={18} />
                            </button>
                        </div>
                    </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Toggle Button (Bottom Right, Draggable) */}
            <motion.button
                drag
                dragElastic={0.2}
                dragConstraints={dragConstraints}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-24 z-[510] w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow cursor-move ${module === 'user' ? 'left-6' : 'right-6'}`}
            >
                {isOpen ? <FiX size={24} /> : <FiMessageSquare size={24} />}
            </motion.button>
        </>
    );
};

export default ChatbotWidget;
