import { useEffect, useRef, useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { ArrowLeft, CheckCircle, Crown, Clock, Calendar, AlertCircle, Loader2, Info, Zap } from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"

import { subscriptionAPI } from "@food/api"
import { initRazorpayPayment, initRazorpaySubscription } from "@food/utils/razorpay"
import { toast } from "react-hot-toast"
import dayjs from "dayjs"

export default function BusinessPlanPage() {
  const navigate = useNavigate()
  const isMountedRef = useRef(true)
  const [plans, setPlans] = useState([])
  const [activeSub, setActiveSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  // Sort plans: DAY -> WEEK -> MONTH
  const sortedPlans = useMemo(() => {
    const order = { 'DAY': 1, 'WEEK': 2, 'MONTH': 3, 'YEAR': 4 };
    return [...plans].sort((a, b) => order[a.durationUnit] - order[b.durationUnit]);
  }, [plans]);

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [plansRes, subRes] = await Promise.all([
        subscriptionAPI.getPlans("RESTAURANT"),
        subscriptionAPI.getMySubscription("RESTAURANT")
      ])
      setPlans(plansRes.data?.data || [])
      setActiveSub(subRes.data?.data || null)
    } catch (error) {
      toast.error("Failed to load subscription details")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const pollActiveSubscription = async ({ timeoutMs = 90_000, intervalMs = 2000 } = {}) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (!isMountedRef.current) return null
      try {
        const subRes = await subscriptionAPI.getMySubscription("RESTAURANT")
        const sub = subRes.data?.data || null
        if (sub) {
          if (isMountedRef.current) setActiveSub(sub)
          return sub
        }
      } catch (_e) {
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return null
  }

  const handlePurchase = async (plan) => {
    try {
      setPurchasing(true)
      const res = await subscriptionAPI.purchase("RESTAURANT", { planId: plan._id })
      const data = res.data?.data
      const isOneTime = !!data.orderId

      const options = {
        key: data.key,
        name: "Itzo Business Plan",
        description: `Subscription: ${plan.name}`,
        handler: async (response) => {
          if (isOneTime) {
            try {
              await subscriptionAPI.verify("RESTAURANT", {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
            } catch (_err) {
            }
          }

          toast.success(isOneTime ? "Payment received. Activating..." : "Payment received. Activating subscription...")
          const activated = await pollActiveSubscription()
          if (activated) {
            toast.success("Subscription Active")
          } else {
            toast.success("Activation pending. Webhook will sync shortly.")
          }
          await fetchData()
          setPurchasing(false)
        },
        onError: (err) => {
          toast.error("Payment failed or cancelled")
          setPurchasing(false)
        },
        onClose: () => {
          toast.error("Payment cancelled")
          setPurchasing(false)
        }
      }

      if (data.orderId) {
        await initRazorpayPayment({ ...options, order_id: data.orderId, amount: data.amount })
      } else {
        await initRazorpaySubscription({ ...options, subscription_id: data.subscriptionId })
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Purchase failed")
      setPurchasing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/food/restaurant/explore")} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold text-slate-900 flex-1">Business Subscription</h1>
      </div>

      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        {/* Active Subscription Status */}
        {activeSub ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Crown className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-[#FE5502] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Active Plan</span>
                </div>
                <h2 className="text-3xl font-black mb-1">{activeSub.planId?.name}</h2>
                <p className="text-slate-400 text-sm mb-6 max-w-md">{activeSub.planId?.description}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Expires On</span>
                    </div>
                    <p className="text-lg font-bold">{dayjs(activeSub.expiryDate).format("DD MMM, YYYY")}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Status</span>
                    </div>
                    <p className={`text-lg font-bold capitalize ${activeSub.status === 'grace' ? 'text-amber-400' : 'text-green-400'}`}>
                      {activeSub.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="mb-8 text-center py-6">
            <h2 className="text-2xl font-black text-slate-900">Grow Your Business</h2>
            <p className="text-slate-500 mt-2">Choose a plan that fits your restaurant's needs</p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-96 bg-slate-200 animate-pulse rounded-3xl" />)
          ) : plans.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center gap-3 text-slate-400">
              <AlertCircle className="w-12 h-12" />
              <p className="font-medium">No active plans available at the moment</p>
            </div>
          ) : (
            sortedPlans.map((plan) => (
              <motion.div 
                key={plan._id} 
                whileHover={{ y: -5 }}
                className={`bg-white rounded-3xl p-6 border-2 transition-all shadow-sm flex flex-col ${activeSub?.planId?._id === plan._id ? 'border-[#FE5502]' : 'border-slate-100'}`}
              >
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-slate-900">₹{plan.price}</span>
                    <span className="text-slate-500 text-sm font-medium">/{plan.durationValue} {plan.durationUnit.toLowerCase()}</span>
                  </div>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">{plan.description}</p>
                  
                  <div className="space-y-3 mb-8">
                    {['Full Access', 'Dashboard Analytics', 'Mobile App Support', 'Customer Reviews'].map(feat => (
                      <div key={feat} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {plan.durationUnit === 'DAY' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 relative overflow-hidden group/info">
                    <div className="flex items-start gap-3 relative z-10">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                        <Info className="w-4 h-4 text-slate-400 group-hover/info:text-[#FE5502] transition-colors" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900 text-sm">Auto Activated</p>
                          <span className="bg-[#FE5502]/10 text-[#FE5502] text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">Smart Flow</span>
                        </div>
                        <p className="text-slate-500 text-[11px] leading-relaxed">
                          One-Day Pass is activated automatically when you turn ON delivery. 
                          <span className="block mt-1 text-slate-400 font-medium italic">Confirmation modal will appear before deduction.</span>
                        </p>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover/info:opacity-[0.07] transition-opacity">
                      <Zap className="w-16 h-16 text-[#FE5502]" />
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={() => handlePurchase(plan)}
                    disabled={purchasing || (activeSub?.status === 'active' && activeSub?.planId?._id === plan._id)}
                    className={`w-full h-12 rounded-2xl font-bold text-sm tracking-wide transition-all ${activeSub?.planId?._id === plan._id ? 'bg-slate-100 text-slate-400' : 'bg-[#FE5502] hover:bg-[#E64D02] text-white shadow-lg shadow-[#FE5502]/20'}`}
                  >
                    {purchasing ? <Loader2 className="w-5 h-5 animate-spin" /> : activeSub?.planId?._id === plan._id ? 'Current Plan' : 'Subscribe Now'}
                  </Button>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>


    </div>
  )
}
