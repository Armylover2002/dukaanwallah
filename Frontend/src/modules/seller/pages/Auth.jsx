import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Store, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@food/components/ui/button";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { sellerApi } from "../services/sellerApi";
import {
  getAppLogo,
} from "@common/utils/businessSettings"

const DEFAULT_COUNTRY_CODE = "+91";

export default function SellerAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const companyName = useCompanyName();
  const { settings } = useSettings();
  const [step, setStep] = useState("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const nextSellerPath =
    typeof location.state?.from === "string" &&
      location.state.from.startsWith("/seller")
      ? location.state.from
      : "/seller";

  const maskedPhone = useMemo(() => {
    if (phone.length < 4) return `${DEFAULT_COUNTRY_CODE} ${phone}`;
    return `${DEFAULT_COUNTRY_CODE} ${phone.slice(0, 2)}******${phone.slice(-2)}`;
  }, [phone]);


  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('seller'))

  useEffect(() => {
    if (settings) {
      setLogoUrl(getAppLogo('seller'))
    }
  }, [settings])



  const validatePhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 10) return "Enter a valid 10-digit mobile number";
    if (!["6", "7", "8", "9"].includes(digits[0])) return "Enter a valid Indian mobile number";
    return "";
  };

  const handleSendOtp = async () => {
    const validation = validatePhone(phone);
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      setIsLoading(true);
      const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim();
      const response = await sellerApi.requestOtp(fullPhone);
      const payload = response?.data?.result || response?.data?.data || response?.data || {};
      const devOtp = payload?.otp || null;
      const deliveryMode = payload?.deliveryMode || "sms";
      const resolvedPhone = String(payload?.phone || fullPhone).trim();

      toast.success(
        devOtp
          ? `OTP ready for localhost testing. Use OTP: ${devOtp}`
          : deliveryMode === "sms"
            ? "OTP sent to your seller number."
            : "OTP generated, but no debug code was returned.",
      );
      setOtpPhone(resolvedPhone);
      setOtp(devOtp ? String(devOtp) : "");
      setStep("otp");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = String(otp || "").replace(/\D/g, "").slice(0, 6);
    if (code.length < 4) {
      toast.error("Enter the OTP you received");
      return;
    }

    try {
      setIsLoading(true);
      const verifyPhone = String(otpPhone || `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()).trim();
      const response = await sellerApi.verifyOtp(verifyPhone, code);
      const data = response?.data?.result || response?.data?.data || response?.data || {};
      const accessToken = data?.accessToken || data?.token;
      const sellerUser = data?.seller || data?.user || data?.data?.seller || data?.data?.user;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token was returned");
      }

      login({
        ...sellerUser,
        name:
          sellerUser?.name ||
          "Seller",
        shopName:
          sellerUser?.shopName ||
          sellerUser?.name ||
          "Store",
        phone:
          sellerUser?.phone ||
          `${DEFAULT_COUNTRY_CODE} ${phone}`.trim(),
        email: sellerUser?.email || "",
        token: accessToken,
        role: "seller",
      });
      toast.success(
        sellerUser?.approved === false
          ? "OTP verified. Continue your seller setup."
          : "Seller login successful",
      );
      navigate(
        sellerUser?.approved === false && sellerUser?.onboardingSubmitted !== true
          ? "/seller/onboarding"
          : nextSellerPath,
        { replace: true },
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const isPhoneValid = phone.length === 10;

  return (
    <div className="relative min-h-screen overflow-hidden bg-white md:bg-[#fcfaf6] md:px-6 md:py-10 font-['Outfit'] seller-theme-scope flex flex-col">
      <div className="hidden md:block absolute inset-0 pointer-events-none">
        <div className="absolute left-[-8%] top-[-8%] h-72 w-72 rounded-full bg-[#d9f99d]/40 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-80 w-80 rounded-full bg-[#86efac]/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex flex-1 w-full max-w-6xl overflow-hidden md:rounded-[36px] md:border md:border-white/70 bg-white md:shadow-[0_40px_120px_rgba(15,23,42,0.08)] flex-col md:flex-row md:min-h-[calc(100vh-5rem)]">
        {/* Desktop Left Panel */}
        <div className="hidden w-[42%] flex-col justify-between bg-[linear-gradient(160deg,#0f172a_0%,#431407_60%,#f26522_100%)] p-10 text-white md:flex">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em]">
              <Store className="h-4 w-4" />
              Seller Console
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight">
              Grow your store with a seller-first login flow.
            </h1>
            <p className="mt-4 max-w-md text-sm font-medium text-white/80">
              Based on your Blinkit reference, adapted to this project's live OTP backend so partners can actually sign in.
            </p>
          </div>

          <div className="space-y-3 text-sm font-semibold text-white/85">
            <div className="rounded-2xl bg-white/10 px-4 py-3">Fast OTP login for store owners</div>
          </div>
        </div>

        {/* Right Panel / Mobile Full Screen */}
        <div className="flex w-full flex-col flex-1 md:w-[58%] md:justify-center relative">

          {/* Mobile Orange Header */}
          <div className="flex flex-col items-center justify-center bg-[#f26522] rounded-b-[40px] px-6 pt-12 pb-10 md:hidden">
            <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-white overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <ShieldCheck className="h-10 w-10 text-orange-500" />
              )}
            </div>
            <h2 className="mt-4 text-[26px] font-black tracking-tight text-white">{companyName}</h2>
            <div className="mt-3 rounded-full bg-white/20 px-5 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white">
              Seller Partner
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full px-6 py-8 md:px-12 flex-1 flex flex-col"
          >
            {/* Desktop Header */}
            <div className="hidden md:flex mb-8 items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-orange-500">Partner Access</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {companyName} seller login
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Use your registered store phone number to receive a one-time code.
                </p>
              </div>
              <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-slate-100 overflow-hidden shrink-0 shadow-sm">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover rounded-2xl" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-orange-500" />
                )}
              </div>
            </div>

            {/* Mobile Header Text */}
            <div className="md:hidden text-center mb-8">
              <h2 className="text-[22px] font-black text-slate-900 tracking-tight">Sign in to your account</h2>
              <p className="mt-1.5 text-[15px] font-medium text-slate-500">Login with your phone number</p>
            </div>

            <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
              <div className="space-y-6 md:rounded-[32px] md:border md:border-slate-200 md:bg-slate-50/70 md:p-6">
                {step === "phone" ? (
                  <div className="p-2 md:p-0">
                    <div className="space-y-2">
                      <div className="flex gap-3 items-center justify-center">
                        <div className="flex h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 shrink-0">
                          <span className="text-[10px] font-bold uppercase text-slate-500 mr-2">IN</span> {DEFAULT_COUNTRY_CODE}
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="Enter 10-digit mobile number"
                          className="h-[48px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-900 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:font-normal placeholder:text-slate-400"
                        />
                      </div>
                      <p className="text-left text-xs text-slate-500 ml-1">Enter exactly 10 digits</p>
                    </div>

                    {/* Desktop Button (since mobile has it at the bottom) */}
                    <div className="hidden md:block mt-6">
                      <Button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isLoading || !isPhoneValid}
                        className="h-[52px] w-full rounded-full bg-[#f26522] text-[15px] font-bold text-white hover:bg-[#d5581e] transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isLoading ? "Sending OTP..." : "Continue"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 md:p-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-600">Code sent to {maskedPhone}</p>
                        <button onClick={() => { setStep("phone"); setOtp(""); setOtpPhone(""); }} className="text-xs font-bold text-[#f26522] hover:underline">Edit</button>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 h-[48px]">
                        <KeyRound className="h-5 w-5 text-slate-400" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="Enter 6-digit OTP"
                          className="flex-1 bg-transparent text-lg font-bold tracking-widest text-slate-900 outline-none placeholder:tracking-normal placeholder:text-slate-300 placeholder:text-[15px]"
                        />
                      </div>
                    </div>

                    {/* Desktop Button */}
                    <div className="hidden md:block mt-6">
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isLoading || otp.length < 4}
                        className="h-[52px] w-full rounded-full bg-[#f26522] text-[15px] font-bold text-white hover:bg-[#d5581e] transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isLoading ? "Verifying..." : "Verify & Login"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Bottom Button Fixed */}
              <div className="md:hidden mt-auto pt-8 pb-4">
                {step === "phone" ? (
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isLoading || !isPhoneValid}
                    className={"w-full h-[52px] rounded-xl font-bold text-[16px] transition-all "}
                  >
                    {isLoading ? "Sending..." : "Continue"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isLoading || otp.length < 4}
                    className={"w-full h-[52px] rounded-xl font-bold text-[16px] transition-all "}
                  >
                    {isLoading ? "Verifying..." : "Continue"}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}