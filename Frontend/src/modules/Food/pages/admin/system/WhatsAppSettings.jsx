import React, { useState, useEffect } from "react";
import { Save, Send, MessageCircle, AlertCircle } from "lucide-react";
import apiClient from "@/services/api/axios.js";
import { toast } from "sonner";

export default function WhatsAppSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    username: "",
    password: "",
    senderId: "BUZWAP"
  });

  // Test Message State
  const [testMsg, setTestMsg] = useState({
    mobile: "",
    customerName: "",
    orderId: "",
    items: "",
    amount: "",
    paymentMethod: ""
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/common/whatsapp/settings");
      if (res.data?.success && res.data?.data) {
        setSettings({
          username: res.data.data.username || "",
          password: res.data.data.password || "",
          senderId: res.data.data.senderId || "BUZWAP"
        });
      }
    } catch (error) {
      toast.error("Failed to load WhatsApp settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await apiClient.put("/common/whatsapp/settings", settings);
      if (res.data?.success) {
        toast.success("WhatsApp settings saved successfully");
      } else {
        toast.error(res.data?.message || "Failed to save settings");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testMsg.mobile) {
      return toast.error("Mobile number is required for test message");
    }
    try {
      setSending(true);
      const res = await apiClient.post("/common/whatsapp/test-message", testMsg);
      if (res.data?.success) {
        toast.success("Test message sent successfully!");
      } else {
        toast.error(res.data?.message || "Failed to send message");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send test message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen font-['Outfit']">
      <div className="w-full mx-auto max-w-4xl">
        
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <MessageCircle className="text-green-500" /> WhatsApp Settings
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              Configure BhashSMS API integration
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200/50 rounded-2xl p-4 mb-6 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-blue-800 uppercase tracking-wider mb-1">Configuration Note</h4>
            <p className="text-xs text-blue-700/80 font-medium leading-relaxed">
              The API URL is securely stored in your server's .env file (WHATSAPP_API_URL). You only need to configure your credentials here. This messaging module is completely isolated.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configuration Card */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">API Credentials</h3>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              {loading ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400">Loading settings...</div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                    <input
                      type="text"
                      value={settings.username}
                      onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none transition-all"
                      placeholder="e.g. now_stay"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                    <input
                      type="password"
                      value={settings.password}
                      onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sender ID</label>
                    <input
                      type="text"
                      value={settings.senderId}
                      onChange={(e) => setSettings({ ...settings, senderId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none transition-all"
                      placeholder="e.g. BUZWAP"
                      required
                    />
                  </div>
                  
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-950 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xs hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      {saving ? "Saving..." : "Save Configuration"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>

          {/* Test Message Card */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Send Test Message</h3>
            </div>
            
            <form onSubmit={handleSendTestMessage} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mobile Number</label>
                <input
                  type="text"
                  value={testMsg.mobile}
                  onChange={(e) => setTestMsg({ ...testMsg, mobile: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Customer Name</label>
                  <input
                    type="text"
                    value={testMsg.customerName}
                    onChange={(e) => setTestMsg({ ...testMsg, customerName: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                    placeholder="e.g. Rahul"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Order ID</label>
                  <input
                    type="text"
                    value={testMsg.orderId}
                    onChange={(e) => setTestMsg({ ...testMsg, orderId: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                    placeholder="e.g. ORD123"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Items</label>
                <input
                  type="text"
                  value={testMsg.items}
                  onChange={(e) => setTestMsg({ ...testMsg, items: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                  placeholder="e.g. Pizza+Burger"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Amount</label>
                  <input
                    type="text"
                    value={testMsg.amount}
                    onChange={(e) => setTestMsg({ ...testMsg, amount: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                    placeholder="e.g. 450"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment Method</label>
                  <input
                    type="text"
                    value={testMsg.paymentMethod}
                    onChange={(e) => setTestMsg({ ...testMsg, paymentMethod: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                    placeholder="e.g. COD"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xs hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  {sending ? "Sending..." : "Send Test Message"}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
