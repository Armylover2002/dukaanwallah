import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    getQuickCategoriesPath,
    getQuickHomePath,
    getQuickOrdersPath,
    getQuickProfilePath,
} from '../../utils/routes';

// Static spring config — defined outside component to avoid recreation
const SPRING_ICON = { type: 'spring', stiffness: 400, damping: 25 };
const SPRING_LINE = { type: 'spring', stiffness: 400, damping: 30 };

const BottomNav = () => {
    const location = useLocation();

    // Derive once per render — no repeated URLSearchParams construction
    const isSharedQuickProfileRoute = useMemo(
        () =>
            location.pathname === '/profile' &&
            new URLSearchParams(location.search).get('from') === 'quick',
        [location.pathname, location.search],
    );

    // navItems depends on pathname only (getQuickHomePath uses pathname)
    const navItems = useMemo(
        () => [
            { label: 'Home', icon: Home, path: getQuickHomePath(location.pathname) },
            { label: 'Category', icon: LayoutGrid, path: getQuickCategoriesPath() },
            { label: 'Orders', icon: ShoppingBag, path: getQuickOrdersPath() },
            { label: 'Profile', icon: User, path: getQuickProfilePath() },
        ],
        [location.pathname],
    );

    // Derived active states — one pass, avoids repeated function calls in JSX
    const activeStates = useMemo(() => {
        const profilePath = getQuickProfilePath();
        return navItems.map((item) => {
            if (item.path === profilePath && isSharedQuickProfileRoute) return true;
            if (item.path === getQuickHomePath(location.pathname)) {
                return location.pathname === item.path;
            }
            return (
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`)
            );
        });
    }, [navItems, location.pathname, isSharedQuickProfileRoute]);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-white/80 dark:bg-card/80 backdrop-blur-xl border-t border-gray-100 dark:border-border flex items-center justify-around h-[70px] md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-4 pb-[env(safe-area-inset-bottom)] transition-all duration-300">
            {navItems.map((item, idx) => {
                const isActive = activeStates[idx];

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className="flex-1 flex flex-col items-center justify-center h-full relative group transition-all"
                    >
                        <div className="flex flex-col items-center justify-center relative">
                            <motion.div
                                animate={{ y: isActive ? -2 : 0, scale: isActive ? 1.1 : 1 }}
                                transition={SPRING_ICON}
                            >
                                <item.icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        'transition-colors duration-300',
                                        isActive
                                            ? 'text-[#FE5502]'
                                            : 'text-gray-400 dark:text-slate-500',
                                    )}
                                />
                            </motion.div>

                            <motion.span
                                animate={{ y: isActive ? 1 : 0 }}
                                className={cn(
                                    'text-[10px] font-bold tracking-tight mt-1 transition-colors duration-300',
                                    isActive
                                        ? 'text-[#FE5502]'
                                        : 'text-gray-400 dark:text-slate-500',
                                )}
                            >
                                {item.label}
                            </motion.span>
                        </div>

                        {isActive && (
                            <motion.div
                                layoutId="topLine"
                                className="absolute -top-[1px] w-8 h-[3px] bg-[#FE5502] rounded-full"
                                transition={SPRING_LINE}
                            />
                        )}
                    </Link>
                );
            })}
        </div>
    );
};

// Prevent re-renders when parent re-renders without location change
export default React.memo(BottomNav);