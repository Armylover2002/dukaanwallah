import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image as ImageIcon } from "lucide-react"
import { deliveryAPI, onboardingFeeAPI } from "@food/api"
import { toast } from "sonner"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { isFlutterBridgeAvailable, openCamera, openGallery } from "@food/utils/imageUploadUtils"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const DB_NAME = "DeliverySignupDB"
const STORE_NAME = "documents"

let cachedDB = null
const initDB = () => {
  return new Promise((resolve) => {
    if (cachedDB) {
      return resolve(cachedDB)
    }
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return resolve(null)
    }
    const timeoutId = setTimeout(() => resolve(null), 2000)
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = (e) => {
        clearTimeout(timeoutId)
        cachedDB = e.target.result
        resolve(cachedDB)
      }
      request.onerror = () => {
        clearTimeout(timeoutId)
        resolve(null)
      }
    } catch (e) {
      clearTimeout(timeoutId)
      resolve(null)
    }
  })
}

const saveFileToDB = async (key, file) => {
  const db = await initDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      store.put(file, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    } catch (e) {
      resolve()
    }
  })
}

const getFileFromDB = async (key) => {
  const db = await initDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch (e) {
      resolve(null)
    }
  })
}

const removeFileFromDB = async (key) => {
  const db = await initDB()
  if (!db) return
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).delete(key)
  } catch (e) {
    debugError("Error removing file from DB:", e)
  }
}

const clearDB = async () => {
  const db = await initDB()
  if (!db) return
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).clear()
  } catch (e) {
    debugError("Error clearing DB:", e)
  }
}

const createEmptyUploadedDocs = () => ({
  profilePhoto: null,
  aadharPhoto: null,
  panPhoto: null,
  drivingLicensePhoto: null
})

const sanitizeUploadedDocValue = (value) => {
  if (!value) return null
  if (typeof value === "string") {
    return value.startsWith("blob:") ? null : value
  }
  if (typeof value === "object") {
    const url = typeof value.url === "string" ? value.url : ""
    if (url.startsWith("blob:")) {
      return null
    }
    return value
  }
  return null
}

const sanitizeUploadedDocs = (docs) => ({
  profilePhoto: sanitizeUploadedDocValue(docs?.profilePhoto),
  aadharPhoto: sanitizeUploadedDocValue(docs?.aadharPhoto),
  panPhoto: sanitizeUploadedDocValue(docs?.panPhoto),
  drivingLicensePhoto: sanitizeUploadedDocValue(docs?.drivingLicensePhoto)
})

const hasDocumentValue = (localFile, uploadedValue) => {
  if (localFile instanceof File) return true
  if (typeof uploadedValue === "string") return uploadedValue.trim().length > 0
  if (uploadedValue && typeof uploadedValue === "object") {
    if (typeof uploadedValue.url === "string" && uploadedValue.url.trim()) return true
    if (uploadedValue && uploadedValue.file === true) return true
  }
  return false
}

const getFriendlyRegistrationError = (error) => {
  const rawMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    ""

  if (/E11000 duplicate key error/i.test(rawMessage)) {
    if (/vehicleNumber_1/i.test(rawMessage) || /vehicleNumber/i.test(rawMessage)) {
      return "This vehicle number is already registered. Please use a different vehicle number."
    }
    if (/panNumber_1/i.test(rawMessage) || /panNumber/i.test(rawMessage)) {
      return "This PAN number is already registered."
    }
    if (/aadharNumber_1/i.test(rawMessage) || /aadharNumber/i.test(rawMessage)) {
      return "This Aadhar number is already registered."
    }
    if (/drivingLicense/i.test(rawMessage)) {
      return "This driving license number is already registered."
    }
    return "This account detail is already registered. Please check your information."
  }

  return rawMessage || "Failed to register. Please try again."
}

// ─── FIX: Flutter WebView detect karne ka helper ───────────────────────────
const isFlutterWebView = () => {
  return typeof window !== "undefined" && !!window.flutter_inappwebview
}

// ─── FIX: Flutter ke through Razorpay payment handle karna ─────────────────
// Agar app mein ho to Flutter ko payment details bhejna padega
// aur Flutter native Razorpay SDK se payment karega.
// Flutter success ke baad result wapas bhejega via JS channel.
const handleFlutterRazorpayPayment = (rzpOptions) => {
  return new Promise((resolve, reject) => {
    // Flutter ko payment initiate karne ka signal do
    try {
      window.flutter_inappwebview.callHandler("initRazorpayPayment", {
        keyId: rzpOptions.key,
        orderId: rzpOptions.order_id,
        amount: rzpOptions.amount,
        currency: rzpOptions.currency || "INR",
        name: rzpOptions.name,
        description: rzpOptions.description,
        prefill: rzpOptions.prefill,
      }).then((result) => {
        // Flutter ne payment complete kiya
        if (result && result.razorpay_payment_id) {
          resolve(result)
        } else {
          reject(new Error(result?.error || "Payment cancelled or failed"))
        }
      }).catch((err) => {
        reject(new Error(err?.message || "Payment failed"))
      })
    } catch (e) {
      reject(new Error("Flutter payment bridge unavailable"))
    }
  })
}

// ─── FIX: FormData ko fresh rebuild karna ──────────────────────────────────
// Razorpay callback mein purana formData reliable nahi hota (async gap mein
// file references stale ho sakte hain). Isliye helper function se fresh
// formData banate hain jab bhi chahiye.
const buildFormData = async (details, documents) => {
  const formData = new FormData()

  const vehicleImageFile = await getFileFromDB("vehicleImage")
  if (vehicleImageFile instanceof File || vehicleImageFile instanceof Blob) {
    formData.append("vehicleImage", vehicleImageFile)
  }

  formData.append("name", details.name || "")
  formData.append("phone", String(details.phone || "").replace(/\D/g, "").slice(0, 15))
  if (details.email) formData.append("email", String(details.email).trim())
  if (details.ref) formData.append("ref", String(details.ref).trim())
  if (details.countryCode) formData.append("countryCode", details.countryCode)
  if (details.address) formData.append("address", details.address)
  if (details.city) formData.append("city", details.city)
  if (details.state) formData.append("state", details.state)
  if (details.vehicleType) formData.append("vehicleType", details.vehicleType)
  if (details.vehicleName) formData.append("vehicleName", details.vehicleName)
  if (details.vehicleNumber) formData.append("vehicleNumber", details.vehicleNumber)
  if (details.drivingLicenseNumber) {
    formData.append("drivingLicenseNumber", details.drivingLicenseNumber)
    formData.append("documents[drivingLicense][number]", details.drivingLicenseNumber)
  }
  if (details.panNumber) formData.append("panNumber", details.panNumber)
  if (details.aadharNumber) formData.append("aadharNumber", details.aadharNumber)

  if (documents.profilePhoto instanceof File) formData.append("profilePhoto", documents.profilePhoto)
  if (documents.aadharPhoto instanceof File) formData.append("aadharPhoto", documents.aadharPhoto)
  if (documents.panPhoto instanceof File) formData.append("panPhoto", documents.panPhoto)
  if (documents.drivingLicensePhoto instanceof File) formData.append("drivingLicensePhoto", documents.drivingLicensePhoto)

  // FCM token
  let fcmToken = null
  let platform = "web"
  try {
    if (typeof window !== "undefined") {
      if (window.flutter_inappwebview) {
        platform = "mobile"
        const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
        for (const handlerName of handlerNames) {
          try {
            const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "delivery" })
            if (t && typeof t === "string" && t.length > 20) {
              fcmToken = t.trim()
              break
            }
          } catch (e) { }
        }
      } else {
        fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null
      }
    }
  } catch (e) {
    debugWarn("Failed to get FCM token", e)
  }

  if (fcmToken) {
    formData.append("fcmToken", fcmToken)
    formData.append("platform", platform)
  }

  return formData
}

// ─── FIX: Registration complete karne ka shared helper ─────────────────────
const submitRegistration = async ({ isCompleteProfile, formData, navigate }) => {
  const response = isCompleteProfile
    ? await deliveryAPI.register(formData)
    : await deliveryAPI.completeProfile(formData)

  if (response?.data?.success) {
    const raw = sessionStorage.getItem("deliverySignupDetails")
    const details = raw ? JSON.parse(raw) : {}
    sessionStorage.removeItem("deliverySignupDetails")
    sessionStorage.removeItem("deliverySignupDocs")
    sessionStorage.removeItem("deliveryIsRejected")
    clearDB()

    const pendingPhone = `${details.countryCode || "+91"} ${String(details.phone || "").replace(/\D/g, "").slice(0, 15)}`.trim()
    sessionStorage.setItem("deliveryPendingPhone", pendingPhone)

    if (isCompleteProfile) {
      sessionStorage.removeItem("deliveryNeedsRegistration")
      toast.success("Registration submitted. Verification is in progress.")
    } else {
      toast.success("Profile submitted. Waiting for admin approval.")
    }

    setTimeout(
      () => navigate("/food/delivery/verification", { replace: true, state: { phone: pendingPhone } }),
      1200
    )
    return true
  }
  return false
}


export default function SignupStep2() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()
  const signupDetailsRaw = sessionStorage.getItem("deliverySignupDetails")
  let signupDetails = {}
  try {
    if (signupDetailsRaw) {
      signupDetails = JSON.parse(signupDetailsRaw)
    }
  } catch (e) { }
  const isDlOptional = signupDetails.vehicleType === "bicycle" || signupDetails.vehicleType === "electric_bike"
  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "")
  const fileInputRefs = useRef({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })
  const [documents, setDocuments] = useState({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })
  const [uploadedDocs, setUploadedDocs] = useState(() => {
    const saved = sessionStorage.getItem("deliverySignupDocs")
    if (saved) {
      try {
        return sanitizeUploadedDocs(JSON.parse(saved))
      } catch (e) {
        debugError("Error parsing saved docs:", e)
      }
    }
    return createEmptyUploadedDocs()
  })
  const [activePicker, setActivePicker] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploading, setUploading] = useState({})
  const [restoring, setRestoring] = useState({})
  const [feeConfig, setFeeConfig] = useState(null)
  const [fetchingFees, setFetchingFees] = useState(false)

  // ─── documents ref: Razorpay callback mein latest state chahiye ────────────
  // FIX: useState setter async hota hai, isliye callback ke andar
  // documents.current se latest files milti hain bina stale closure ke.
  const documentsRef = useRef(documents)
  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true)
        const isRejected = sessionStorage.getItem("deliveryIsRejected") === "true"
        if (isRejected) {
          setFeeConfig(null)
          return
        }
        const res = await onboardingFeeAPI.getPublicFees()
        const fees = res?.data?.data || res?.data
        if (fees && fees.DELIVERY_PARTNER) {
          setFeeConfig(fees.DELIVERY_PARTNER)
        }
      } catch (err) {
        debugError("Failed to fetch public onboarding fee for delivery partner:", err)
      } finally {
        setFetchingFees(false)
      }
    }
    fetchFees()
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    const loadSavedFiles = async () => {
      const docTypes = ["profilePhoto", "aadharPhoto", "panPhoto", "drivingLicensePhoto"]
      const restored = {}
      let hasRestored = false

      setRestoring(Object.fromEntries(docTypes.map(t => [t, true])))

      const safetyTimer = setTimeout(() => {
        setRestoring({})
      }, 4000)

      try {
        await Promise.all(
          docTypes.map(async (type) => {
            const file = await getFileFromDB(type)
            if (file && (file instanceof File || file instanceof Blob)) {
              const restoredFile = file instanceof File ? file : new File([file], `${type}.jpg`, { type: file.type || "image/jpeg" })
              restored[type] = restoredFile
              hasRestored = true
            }
          })
        )
      } catch (e) {
        debugError("Error loading saved files from DB:", e)
      } finally {
        clearTimeout(safetyTimer)
        setRestoring({})
      }

      if (hasRestored) {
        setDocuments(prev => ({ ...prev, ...restored }))
      }
    }
    loadSavedFiles()
  }, [])

  useEffect(() => {
    sessionStorage.setItem("deliverySignupDocs", JSON.stringify(uploadedDocs))
  }, [uploadedDocs])

  useEffect(() => {
    return () => {
      Object.values(documents).forEach((file) => {
        if (file instanceof File) {
          const previewUrl = file.previewUrl || file._previewUrl
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
          }
        }
      })
    }
  }, [])

  const getPreviewSrc = (docType) => {
    const uploaded = uploadedDocs[docType]
    if (typeof uploaded === "string") return uploaded
    if (uploaded?.url) return uploaded.url

    const localFile = documents[docType]
    if (localFile instanceof File) {
      if (!localFile._previewUrl) {
        localFile._previewUrl = URL.createObjectURL(localFile)
      }
      return localFile._previewUrl
    }
    return null
  }

  const handleOpenUploadOptions = (docType) => {
    fileInputRefs.current[docType]?.click()
  }

  const handleFileSelect = async (docType, file) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    setDocuments((prev) => {
      const oldFile = prev[docType]
      if (oldFile && oldFile._previewUrl) {
        URL.revokeObjectURL(oldFile._previewUrl)
      }
      return { ...prev, [docType]: file }
    })
    setUploadedDocs((prev) => ({ ...prev, [docType]: { file: true } }))
    await saveFileToDB(docType, file)
    toast.success(`${docType.replace(/([A-Z])/g, " $1").trim()} selected`)
  }

  const handleTakeCameraPhoto = (docType, label) => {
    openCamera({
      onSelectFile: (file) => handleFileSelect(docType, file),
      fileNamePrefix: `signup-${docType}`
    })
  }

  const handlePickFromGallery = (docType) => {
    openGallery({
      onSelectFile: (file) => handleFileSelect(docType, file),
      fileNamePrefix: `signup-${docType}`
    })
  }

  const handleRemove = (docType) => {
    setDocuments(prev => {
      const file = prev[docType]
      if (file && file._previewUrl) {
        URL.revokeObjectURL(file._previewUrl)
      }
      return { ...prev, [docType]: null }
    })
    setUploadedDocs(prev => ({
      ...prev,
      [docType]: null
    }))
    removeFileFromDB(docType)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const hasProfilePhoto = hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto)
    const hasAadharPhoto = hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto)
    const hasPanPhoto = hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto)
    const hasDrivingLicensePhoto = hasDocumentValue(
      documents.drivingLicensePhoto,
      uploadedDocs.drivingLicensePhoto
    )

    if (!hasProfilePhoto || !hasAadharPhoto || !hasPanPhoto || (!isDlOptional && !hasDrivingLicensePhoto)) {
      toast.error("Please upload all required documents")
      return
    }

    const raw = sessionStorage.getItem("deliverySignupDetails")
    if (!raw) {
      toast.error("Session expired. Please start from Create Account.")
      navigate("/food/delivery/signup", { replace: true })
      return
    }

    let details
    try {
      details = JSON.parse(raw)
    } catch {
      toast.error("Invalid session. Please start from Create Account.")
      navigate("/food/delivery/signup", { replace: true })
      return
    }

    const isCompleteProfile = sessionStorage.getItem("deliveryNeedsRegistration") === "true"

    setIsSubmitting(true)

    try {
      if (feeConfig && feeConfig.isActive && feeConfig.price > 0) {
        // Payment required path
        const orderRes = await onboardingFeeAPI.createOrder({
          role: "DELIVERY_PARTNER",
          name: details.name || "Delivery Partner",
          phone: String(details.phone || "").replace(/\D/g, "").slice(0, 15),
          email: details.email || ""
        })
        const orderData = orderRes?.data?.data || orderRes?.data

        if (!orderData || !orderData.orderId) {
          throw new Error("Failed to create onboarding payment order")
        }

        if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
          // Dev mode: payment bypass
          toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.")
          // ─── FIX: Fresh formData build karo ──────────────────────────────
          const formData = await buildFormData(details, documentsRef.current)
          formData.append("razorpayOrderId", orderData.orderId)
          formData.append("razorpayPaymentId", `mock_pay_${Date.now()}`)
          formData.append("razorpaySignature", `mock_sig_${Date.now()}`)
          await submitRegistration({ isCompleteProfile, formData, navigate })

        } else if (isFlutterWebView()) {
          // ─── FIX: Flutter app mein native Razorpay SDK use karo ──────────
          // Web Razorpay modal Flutter WebView mein kaam nahi karta.
          // Flutter ko payment request bhejo, woh native SDK se karega.
          setIsSubmitting(false)
          try {
            const paymentResult = await handleFlutterRazorpayPayment({
              key: orderData.keyId,
              order_id: orderData.orderId,
              amount: Math.round(orderData.amount * 100),
              currency: orderData.currency || "INR",
              name: "Onboarding Fee Payment",
              description: `Onboarding fee for ${details.name}`,
              prefill: {
                name: details.name || "",
                email: details.email || "",
                contact: String(details.phone || "").replace(/\D/g, "").slice(0, 15)
              }
            })

            // Payment success - ab registration karo
            setIsSubmitting(true)
            // ─── FIX: Fresh formData build karo payment ke baad ────────────
            const formData = await buildFormData(details, documentsRef.current)
            formData.append("razorpayOrderId", paymentResult.razorpay_order_id || orderData.orderId)
            formData.append("razorpayPaymentId", paymentResult.razorpay_payment_id)
            formData.append("razorpaySignature", paymentResult.razorpay_signature)
            await submitRegistration({ isCompleteProfile, formData, navigate })

          } catch (payErr) {
            const msg = payErr?.message || "Payment failed or cancelled"
            if (/cancel/i.test(msg)) {
              toast.error("Payment cancelled. Payment is required to complete signup.")
            } else {
              toast.error(msg)
            }
          } finally {
            setIsSubmitting(false)
          }

        } else {
          // ─── Web browser: purana Razorpay modal flow ─────────────────────
          setIsSubmitting(false)
          const rzpOptions = {
            key: orderData.keyId,
            amount: Math.round(orderData.amount * 100),
            currency: orderData.currency || "INR",
            order_id: orderData.orderId,
            name: "Onboarding Fee Payment",
            description: `Onboarding fee for ${details.name}`,
            prefill: {
              name: details.name || "",
              email: details.email || "",
              contact: String(details.phone || "").replace(/\D/g, "").slice(0, 15)
            },
            handler: async (response) => {
              try {
                setIsSubmitting(true)
                // ─── FIX: Callback mein bhi fresh formData build karo ──────
                const formData = await buildFormData(details, documentsRef.current)
                formData.append("razorpayOrderId", response.razorpay_order_id)
                formData.append("razorpayPaymentId", response.razorpay_payment_id)
                formData.append("razorpaySignature", response.razorpay_signature)
                await submitRegistration({ isCompleteProfile, formData, navigate })
              } catch (error) {
                debugError("Error submitting registration:", error)
                toast.error(getFriendlyRegistrationError(error))
              } finally {
                setIsSubmitting(false)
              }
            },
            onError: (err) => {
              toast.error(err?.description || "Payment failed. Please try again.")
              setIsSubmitting(false)
            },
            onClose: () => {
              toast.error("Payment modal closed. Payment is required to complete signup.")
              setIsSubmitting(false)
            }
          }
          await initRazorpayPayment(rzpOptions)
        }

      } else {
        // ─── Fee nahi hai: seedha register karo ──────────────────────────
        // ─── FIX: Fresh formData build karo ──────────────────────────────
        const formData = await buildFormData(details, documentsRef.current)
        await submitRegistration({ isCompleteProfile, formData, navigate })
      }
    } catch (error) {
      debugError("Error submitting registration:", error)
      toast.error(getFriendlyRegistrationError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const DocumentUpload = ({ docType, label, required = true }) => {
    const uploaded = uploadedDocs[docType]
    const isUploading = uploading[docType] || restoring[docType]
    const hasUploadedDocument = hasDocumentValue(documents[docType], uploaded)

    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {hasUploadedDocument ? (
          <div className="relative">
            <img
              src={getPreviewSrc(docType)}
              alt={label}
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleRemove(docType)}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
              <Check className="w-4 h-4" />
              <span>Uploaded</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors px-4">
            <div className="flex flex-col items-center justify-center pt-5 pb-3">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
                  <p className="text-sm text-gray-500">{uploading[docType] ? "Uploading..." : "Restoring..."}</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 mb-1">Upload document</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                </>
              )}
            </div>

            {!isUploading && (
              <div className="w-full grid grid-cols-2 gap-2 pb-4">
                <button
                  type="button"
                  onClick={() => handleTakeCameraPhoto(docType, label)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold cursor-pointer hover:bg-black transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePickFromGallery(docType)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#00B761] text-white text-xs font-bold cursor-pointer hover:bg-[#00A055] transition-all active:scale-95"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Gallery</span>
                </button>
              </div>
            )}

            <input
              ref={(node) => {
                fileInputRefs.current[docType] = node
              }}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
              onClick={(e) => {
                e.target.value = ""
              }}
              onChange={(e) => {
                const selectedFile = e.target.files[0]
                if (selectedFile) {
                  handleFileSelect(docType, selectedFile)
                }
                e.target.value = ""
              }}
              disabled={isUploading}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Upload Documents</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Document Verification</h2>
          <p className="text-sm text-gray-600">Please upload clear photos of your documents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentUpload docType="profilePhoto" label="Profile Photo" required={true} />
          <DocumentUpload docType="aadharPhoto" label="Aadhar Card Photo" required={true} />
          <DocumentUpload docType="panPhoto" label="PAN Card Photo" required={true} />
          <DocumentUpload docType="drivingLicensePhoto" label="Driving License Photo" required={!isDlOptional} />

          {feeConfig && feeConfig.isActive && feeConfig.price > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1">
              <h3 className="text-sm font-bold text-orange-800">Required Onboarding Fee</h3>
              <p className="text-xs text-orange-700">
                An onboarding fee of <span className="font-bold">₹{feeConfig.price}</span> is required to register as a delivery partner. You will pay secure online on the next step.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto) ||
              !hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto) ||
              !hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto) ||
              (!isDlOptional && !hasDocumentValue(documents.drivingLicensePhoto, uploadedDocs.drivingLicensePhoto))
            }
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting ||
              !hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto) ||
              !hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto) ||
              !hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto) ||
              (!isDlOptional && !hasDocumentValue(documents.drivingLicensePhoto, uploadedDocs.drivingLicensePhoto))
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isSubmitting ? "Submitting..." : "Complete Signup"}
          </button>
        </form>
      </div>

    </div>
  )
}