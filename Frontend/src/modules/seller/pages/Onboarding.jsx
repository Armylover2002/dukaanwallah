import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImageSourcePicker } from "@food/components/ImageSourcePicker";
import { openGallery } from "@food/utils/imageUploadUtils";
import { useAuth } from "@core/context/AuthContext";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  FileBadge2,
  Loader2,
  MapPin,
  ShieldCheck,
  Store,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { onboardingFeeAPI } from "../../../services/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import MapPicker from "@shared/components/MapPicker";

const businessTypes = [
  "Grocery",
  "Bakery",
  "Pharmacy",
  "Electronics",
  "Fashion",
  "General Store",
];

const initialState = {
  name: "",
  shopName: "",
  email: "",
  phone: "",
  zoneId: "",
  zoneSource: "",
  address: "",
  lat: "",
  lng: "",
  radius: 5,
  businessType: "",
  alternatePhone: "",
  supportEmail: "",
  openingHours: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  accountType: "",
  upiId: "",
  panNumber: "",
  gstRegistered: false,
  gstNumber: "",
  gstLegalName: "",
  fssaiNumber: "",
  fssaiExpiry: "",
  shopLicenseNumber: "",
  shopLicenseExpiry: "",
};

const parseOpeningHours = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { openingTime: "", closingTime: "" };
  }

  const match = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?\s*(?:-|to)\s*(\d{1,2}:\d{2})(?::\d{2})?/i);
  if (match) {
    return {
      openingTime: match[1].padStart(5, "0"),
      closingTime: match[2].padStart(5, "0"),
    };
  }

  return { openingTime: "", closingTime: "" };
};

const buildOpeningHoursLabel = (openingTime, closingTime) => {
  if (!openingTime || !closingTime) return "";
  return `${openingTime} - ${closingTime}`;
};
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const normalizeTimeValue = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const formatTimeTo12Hour = (time24) => {
  if (!time24 || !time24.includes(":")) return time24;
  const [hourStr, minuteStr] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const formattedHour = String(hour).padStart(2, "0");
  return `${formattedHour}:${minuteStr} ${ampm}`;
};

const formatOpeningHoursPreview = (preview) => {
  if (!preview || preview === "Not set") return preview;
  const parts = preview.split(" - ");
  if (parts.length === 2) {
    return `${formatTimeTo12Hour(parts[0])} - ${formatTimeTo12Hour(parts[1])}`;
  }
  return preview;
};

const getSellerPhone = (seller = {}) => seller.phone || "";


export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [form, setForm] = useState(initialState);
  const [qrFile, setQrFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoursDraft, setHoursDraft] = useState({ openingTime: "", closingTime: "" });
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [feeConfig, setFeeConfig] = useState(undefined);
  const [fetchingFees, setFetchingFees] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [isReonboardBypass, setIsReonboardBypass] = useState(false);
  const [currentStep, setCurrentStep] = useState(() => {
    const savedStep = sessionStorage.getItem("seller_onboarding_step");
    return savedStep ? parseInt(savedStep, 10) : 1;
  });
  const [isQrPickerOpen, setIsQrPickerOpen] = useState(false);
  const [isLicensePickerOpen, setIsLicensePickerOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("seller_onboarding_step", currentStep.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const validateStep1 = () => {
    if (!form.name || !form.name.trim()) {
      toast.error("Seller name is required");
      return false;
    }
    if (!form.shopName || !form.shopName.trim()) {
      toast.error("Shop name is required");
      return false;
    }
    if (!form.email || !form.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
      toast.error("Enter a valid email address (e.g. name@domain.com)");
      return false;
    }
    if (!form.businessType) {
      toast.error("Business type is required");
      return false;
    }
    if (!form.alternatePhone) {
      toast.error("Alternate phone number is required");
      return false;
    }
    if (form.alternatePhone === form.phone) {
      toast.error("Alternate phone number cannot be the same as primary phone number");
      return false;
    }
    if (!form.zoneId) {
      toast.error("Service zone is required");
      return false;
    }
    if (!form.supportEmail) {
      toast.error("Support email is required");
      return false;
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail)) {
      toast.error("Enter a valid support email address (e.g. support@example.com)");
      return false;
    }
    if (!form.address || !form.lat || !form.lng) {
      toast.error("Please pick your store location on the map first");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.bankName || !form.bankName.trim()) {
      toast.error("Bank name is required");
      return false;
    }
    if (!form.accountHolderName || !form.accountHolderName.trim()) {
      toast.error("Account holder name is required");
      return false;
    }
    if (!form.accountNumber || !/^\d{9,18}$/.test(form.accountNumber) || /^0+$/.test(form.accountNumber)) {
      toast.error("Account number must be 9–18 digits and cannot be all zeros");
      return false;
    }
    if (!form.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      toast.error("Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)");
      return false;
    }
    if (!form.accountType) {
      toast.error("Account type is required");
      return false;
    }
    if (!form.upiId || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId)) {
      toast.error("Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!form.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber)) {
      toast.error("Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)");
      return false;
    }
    if (form.gstRegistered) {
      if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber)) {
        toast.error("Invalid GST format. Must be 15 characters (e.g. 22ABCDE1234F1Z5)");
        return false;
      }
    }
    if (form.fssaiNumber && (!/^\d{14}$/.test(form.fssaiNumber) || /^0+$/.test(form.fssaiNumber))) {
      toast.error("FSSAI number must be exactly 14 digits and cannot be all zeros");
      return false;
    }
    if (form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("FSSAI expiry date cannot be a past date");
      return false;
    }
    if (!form.shopLicenseNumber || !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) || /^0+$/.test(form.shopLicenseNumber)) {
      toast.error("Shop license number must be 5–20 characters and cannot be all zeros");
      return false;
    }
    if (!form.shopLicenseExpiry || form.shopLicenseExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("Shop license expiry date cannot be a past date");
      return false;
    }
    if (!licenseFile) {
      toast.error("Shop License Image is required.");
      return false;
    }
    return true;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (validateStep1() && validateStep2() && validateStep3()) {
      await handleSubmit(e);
    }
  };

  const qrImageInputRef = useRef(null);
  const licenseImageInputRef = useRef(null);
  const [sourcePicker, setSourcePicker] = useState({
    isOpen: false,
    title: "",
    onSelectFile: null,
    fileNamePrefix: "camera-image",
    fallbackInputRef: null,
  });

  const openImageSourcePicker = ({ title, onSelectFile, fileNamePrefix, fallbackInputRef }) => {
    setSourcePicker({
      isOpen: true,
      title: title || "Select image source",
      onSelectFile,
      fileNamePrefix: fileNamePrefix || "camera-image",
      fallbackInputRef: fallbackInputRef || null,
    });
  };

  const closeImageSourcePicker = () => {
    setSourcePicker((prev) => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true);
        const res = await onboardingFeeAPI.getPublicFees();
        const fees = res?.data?.data || res?.data;
        if (fees && fees.SELLER) {
          setFeeConfig(fees.SELLER);
        }
      } catch (err) {
        console.error("Failed to fetch public onboarding fee for seller:", err);
      } finally {
        setFetchingFees(false);
      }
    };
    fetchFees();
  }, []);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({ ...initialState, phone: getSellerPhone(user) || prev.phone }));
      setHoursDraft({ openingTime: "", closingTime: "" });
    }
  }, [user]);

  useEffect(() => {
    const loadProfile = async () => {
      const sellerToken = localStorage.getItem("auth_seller");
      if (!sellerToken) {
        setIsLoading(false);
        navigate("/seller/auth", { replace: true });
        return;
      }

      try {
        const response = await sellerApi.getProfile();
        const data = response?.data?.result || {};

        const isDummyName = data.name && String(data.name).startsWith("Seller ");
        const isDummyShopName = data.shopName && String(data.shopName).startsWith("Store ");
        const isDummyEmail = data.email && (String(data.email).endsWith("@seller.local") || String(data.email).endsWith("@user.local"));

        const populatedForm = {
          ...initialState,
          name: isDummyName ? "" : (data.name || ""),
          shopName: isDummyShopName ? "" : (data.shopName || ""),
          email: isDummyEmail ? "" : (data.email || ""),
          phone: getSellerPhone(data) || initialState.phone,
          zoneId: data.shopInfo?.zoneId || data.zoneId || "",
          zoneSource: data.shopInfo?.zoneSource || data.zoneSource || "",
          address: data.location?.formattedAddress || data.location?.address || data.address || "",
          lat: data.location?.coordinates?.[1] || data.location?.latitude || data.lat || "",
          lng: data.location?.coordinates?.[0] || data.location?.longitude || data.lng || "",
          radius: data.serviceRadius || data.radius || 5,
          businessType: data.shopInfo?.businessType || data.businessType || "",
          alternatePhone: data.shopInfo?.alternatePhone || data.alternatePhone || "",
          supportEmail: data.shopInfo?.supportEmail || data.supportEmail || "",
          openingHours: data.shopInfo?.openingHours || data.openingHours || "",
          bankName: data.bankInfo?.bankName || "",
          accountHolderName: data.bankInfo?.accountHolderName || "",
          accountNumber: data.bankInfo?.accountNumber || "",
          ifscCode: data.bankInfo?.ifscCode || "",
          accountType: data.bankInfo?.accountType || "",
          upiId: data.bankInfo?.upiId || "",
          panNumber: data.documents?.panNumber || "",
          gstRegistered: data.documents?.gstRegistered || false,
          gstNumber: data.documents?.gstNumber || "",
          gstLegalName: data.documents?.gstLegalName || "",
          fssaiNumber: data.documents?.fssaiNumber || "",
          fssaiExpiry: data.documents?.fssaiExpiry ? String(data.documents.fssaiExpiry).split("T")[0] : "",
          shopLicenseNumber: data.documents?.shopLicenseNumber || "",
          shopLicenseExpiry: data.documents?.shopLicenseExpiry ? String(data.documents.shopLicenseExpiry).split("T")[0] : "",
        };

        if (sessionStorage.getItem("sellerReonboard") === "true") {
          setForm((prev) => ({ ...populatedForm }));
          setHoursDraft(parseOpeningHours(data?.shopInfo?.openingHours || data?.openingHours || ""));
          setRejectionReason(data.approvalNotes || data.rejectionReason || "Your previous application was rejected. Please update your details.");
          setIsReonboardBypass(true); // bypass payment for re-applying
        } else {
          setForm((prev) => ({ ...populatedForm }));
          setHoursDraft(parseOpeningHours(data?.shopInfo?.openingHours || data?.openingHours || ""));

          // If rejected, show reason and bypass onboarding fee
          if (data?.approvalStatus === "rejected") {
            setRejectionReason(data.approvalNotes || data.rejectionReason || "Your previous application was rejected. Please update your details.");
            setIsReonboardBypass(true); // bypass payment for re-applying
          } else if (data?.approvalStatus === "pending_approval" || data?.approvalStatus === "approved" || data?.onboardingSubmitted) {
            setIsReonboardBypass(true); // bypass payment if already registered
          }
        }

        // Restore from draft if available
        try {
          const draft = localStorage.getItem("sellerOnboardingDraft");
          if (draft) {
            const parsedDraft = JSON.parse(draft);
            if (parsedDraft.phone === getSellerPhone(data)) {
              setForm((prev) => ({ ...prev, ...parsedDraft }));
            }
          }
        } catch (e) {
          console.error("Error loading draft", e);
        }
        setIsDraftLoaded(true);
      } catch (error) {
        if (error?.response?.status !== 401) {
          toast.error("Failed to load seller onboarding data");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const loadZones = async () => {
      try {
        setZonesLoading(true);
        const quickResponse = await sellerApi.getQuickZonesPublic();
        const quickZones = Array.isArray(quickResponse?.data?.result?.zones)
          ? quickResponse.data.result.zones
          : Array.isArray(quickResponse?.data?.data?.zones)
            ? quickResponse.data.data.zones
            : [];

        setZones(
          quickZones.map((zone) => ({
            ...zone,
            source: "quick",
            label: zone?.name || zone?.zoneName || zone?.serviceLocation || "Quick Zone",
          })),
        );
      } catch (error) {
        toast.error("Failed to load service zones");
        setZones([]);
      } finally {
        setZonesLoading(false);
      }
    };

    loadZones();
  }, []);

  useEffect(() => {
    if (isDraftLoaded && !isLoading) {
      localStorage.setItem("sellerOnboardingDraft", JSON.stringify(form));
    }
  }, [form, isDraftLoaded, isLoading]);

  const completionText = useMemo(() => {
    const fields = [
      form.name,
      form.shopName,
      form.email,
      form.address,
      form.businessType,
      form.accountNumber,
      form.ifscCode,
      form.upiId,
      form.shopLicenseNumber,
    ];
    const done = fields.filter(Boolean).length;
    return `${done}/9 core fields filled`;
  }, [form]);

  const initialLocation = useMemo(
    () => (form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null),
    [form.lat, form.lng],
  );

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const { openingTime, closingTime } = useMemo(
    () => parseOpeningHours(form.openingHours),
    [form.openingHours],
  );


  const selectedZone = useMemo(
    () =>
      zones.find(
        (zone) =>
          String(zone?._id || zone?.id || "") === String(form.zoneId || "") &&
          String(zone?.source || "") === String(form.zoneSource || ""),
      ) || null,
    [form.zoneId, form.zoneSource, zones],
  );

  const handleOpeningHoursChange = (key, value) => {
    const normalizedValue = normalizeTimeValue(value);
    setHoursDraft((prev) => ({
      ...prev,
      [key]: normalizedValue,
    }));
  };

  const handleSaveOpeningHours = async () => {
    if (!hoursDraft.openingTime || !hoursDraft.closingTime) {
      toast.error("Select both opening and closing time first");
      return;
    }
    if (hoursDraft.closingTime === hoursDraft.openingTime) {
      toast.error("Closing time cannot be the same as opening time");
      return;
    }
    if (hoursDraft.closingTime < hoursDraft.openingTime) {
      toast.error("Closing time must be later than opening time");
      return;
    }
    const openingHoursLabel = buildOpeningHoursLabel(
      hoursDraft.openingTime,
      hoursDraft.closingTime,
    );

    setIsSavingHours(true);
    try {
      updateField("openingHours", openingHoursLabel);
      await sellerApi.updateProfile({
        openingHours: openingHoursLabel,
      });
      toast.success("Opening hours saved");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to save opening hours",
      );
    } finally {
      setIsSavingHours(false);
    }
  };

  const openingHoursPreview =
    formatOpeningHoursPreview(
      buildOpeningHoursLabel(hoursDraft.openingTime, hoursDraft.closingTime) ||
      form.openingHours ||
      "Not set"
    );



  const handleLocationSelect = (location) => {
    setForm((prev) => ({
      ...prev,
      lat: Number.isFinite(location?.lat) ? Number(location.lat.toFixed(6)) : prev.lat,
      lng: Number.isFinite(location?.lng) ? Number(location.lng.toFixed(6)) : prev.lng,
      radius: location?.radius !== undefined ? location.radius : prev.radius,
      address: location?.address || prev.address,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.shopName || !form.email || !form.address) {
      toast.error("Fill seller name, shop name, email, and address first");
      return;
    }

    if (form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
      toast.error("Enter a valid email address (e.g. name@gmail.com)");
      return;
    }

    if (form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail)) {
      toast.error("Enter a valid support email address (e.g. support@example.com)");
      return;
    }

    if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber)) {
      toast.error("Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)");
      return;
    }

    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber)) {
      toast.error("Invalid GST format. Must be 15 characters (e.g. 22ABCDE1234F1Z5)");
      return;
    }

    if (form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("FSSAI expiry date cannot be a past date");
      return;
    }

    if (form.shopLicenseNumber && (!/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) || /^0+$/.test(form.shopLicenseNumber))) {
      toast.error("Shop license number must be 5–20 characters and cannot be all zeros");
      return;
    }

    if (form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0]) {
      toast.error("Shop license expiry date cannot be a past date");
      return;
    }

    if (form.accountNumber && (!/^\d{9,18}$/.test(form.accountNumber) || /^0+$/.test(form.accountNumber))) {
      toast.error("Account number must be 9–18 digits and cannot be all zeros");
      return;
    }

    if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
      toast.error("Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)");
      return;
    }

    if (form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId)) {
      toast.error("Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)");
      return;
    }

    if (form.alternatePhone && form.alternatePhone === form.phone) {
      toast.error("Alternate phone number cannot be the same as primary phone number");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      const nextForm = {
        ...form,
        zoneName: selectedZone?.label || "",
      };
      Object.entries(nextForm).forEach(([key, value]) => {
        payload.append(
          key,
          typeof value === "boolean" ? String(value) : String(value ?? ""),
        );
      });
      payload.append("submitForApproval", "true");
      if (qrFile) payload.append("upiQrImage", qrFile);
      if (licenseFile) payload.append("shopLicenseImage", licenseFile);

      if (feeConfig && !isReonboardBypass && feeConfig.isActive && feeConfig.price > 0) {
        const orderRes = await onboardingFeeAPI.createOrder({
          role: "SELLER",
          name: form.name || form.shopName,
          phone: form.phone || form.alternatePhone,
          email: form.email || ""
        });
        const orderData = orderRes?.data?.data || orderRes?.data;

        if (!orderData || !orderData.orderId) {
          throw new Error("Failed to create onboarding payment order");
        }

        if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
          toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.");
          payload.append("razorpayOrderId", orderData.orderId);
          payload.append("razorpayPaymentId", `mock_pay_${Date.now()}`);
          payload.append("razorpaySignature", `mock_sig_${Date.now()}`);

          await sellerApi.updateProfile(payload);
          await refreshUser();
          sessionStorage.removeItem("sellerReonboard");
          localStorage.removeItem("sellerOnboardingDraft");
          sessionStorage.removeItem("seller_onboarding_step");
          toast.success("Application submitted for admin approval");
          navigate("/seller/pending", { replace: true });
        } else {
          // Open real Razorpay modal
          setIsSubmitting(false); // Let interactive flow proceed
          const rzpOptions = {
            key: orderData.keyId,
            amount: Math.round(orderData.amount * 100),
            currency: orderData.currency || "INR",
            order_id: orderData.orderId,
            name: "Onboarding Fee Payment",
            description: `Onboarding fee for ${form.shopName}`,
            prefill: {
              name: form.name || "",
              email: form.email || "",
              contact: form.phone || ""
            },
            handler: async (response) => {
              try {
                setIsSubmitting(true);
                payload.append("razorpayOrderId", response.razorpay_order_id);
                payload.append("razorpayPaymentId", response.razorpay_payment_id);
                payload.append("razorpaySignature", response.razorpay_signature);

                await sellerApi.updateProfile(payload);
                await refreshUser();
                sessionStorage.removeItem("sellerReonboard");
                localStorage.removeItem("sellerOnboardingDraft");
                sessionStorage.removeItem("seller_onboarding_step");
                toast.success("Application submitted for admin approval");
                navigate("/seller/pending", { replace: true });
              } catch (error) {
                toast.error(error?.response?.data?.message || "Failed to submit onboarding");
              } finally {
                setIsSubmitting(false);
              }
            },
            onError: (err) => {
              toast.error(err?.description || "Payment failed. Please try again.");
              setIsSubmitting(false);
            },
            onClose: () => {
              toast.error("Payment modal closed. Payment is required to complete onboarding.");
              setIsSubmitting(false);
            }
          };
          await initRazorpayPayment(rzpOptions);
        }
      } else {
        await sellerApi.updateProfile(payload);
        await refreshUser();
        sessionStorage.removeItem("sellerReonboard");
        localStorage.removeItem("sellerOnboardingDraft");
        sessionStorage.removeItem("seller_onboarding_step");
        toast.success("Application submitted for admin approval");
        navigate("/seller/pending", { replace: true });
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to submit onboarding",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#fffaf2_100%)] px-4 py-8 font-['Outfit'] md:px-8 seller-theme-scope">
      <div className="mx-auto max-w-7xl">
        {rejectionReason && (
          <div className="mb-6 rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 shadow-sm">
            <div className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86C20.47 19 21.5 17.56 20.79 16.13L13.93 3.93a2 2 0 00-3.86 0L2.21 16.13C1.5 17.56 2.53 19 4.07 19z" /></svg>
            </div>
            <div>
              <p className="text-sm font-black text-red-800">Previous Application Rejected</p>
              <p className="mt-1 text-sm font-medium text-red-700">{rejectionReason}</p>
              <p className="mt-2 text-xs font-medium text-red-500">Please update your details below and resubmit. No payment will be charged for re-applying.</p>
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex justify-center items-center mb-8 px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-50 text-orange-600 px-5 py-3 text-sm md:text-base font-black uppercase tracking-[0.2em] md:tracking-[0.3em] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
              Seller Onboarding
            </div>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleFormSubmit}
            className="space-y-6 rounded-[34px] border border-white/70 bg-white/90 p-5 md:p-6 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur xl:p-8 w-full max-w-full overflow-hidden"
          >
            {/* Steps Progress Indicator */}
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-6">
              {[
                { step: 1, label: "Identity", icon: Store },
                { step: 2, label: "Banking", icon: CreditCard },
                { step: 3, label: "Compliance", icon: FileBadge2 }
              ].map((s, idx) => {
                const IconComponent = s.icon;
                const isCompleted = currentStep > s.step;
                const isActive = currentStep === s.step;
                return (
                  <React.Fragment key={s.step}>
                    <div
                      onClick={() => {
                        if (s.step === 1) setCurrentStep(1);
                        else if (s.step === 2 && validateStep1()) setCurrentStep(2);
                        else if (s.step === 3 && validateStep1() && validateStep2()) setCurrentStep(3);
                      }}
                      className="flex flex-col items-center flex-1 cursor-pointer group"
                    >
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${isCompleted
                          ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-100"
                          : isActive
                            ? "border-orange-500 bg-white text-orange-500 ring-4 ring-orange-100/50"
                            : "border-slate-200 bg-slate-50 text-slate-400 group-hover:border-slate-300"
                          }`}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5 stroke-[3]" />
                        ) : (
                          <IconComponent className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-black uppercase tracking-wider ${isActive || isCompleted ? "text-slate-800" : "text-slate-400"
                          }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div
                        className={`h-[2px] flex-1 mx-2 -translate-y-3 transition-colors duration-300 ${currentStep > s.step ? "bg-orange-500" : "bg-slate-200"
                          }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-100 p-3 text-orange-500">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Store identity
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                      How your seller account will appear to admin and customers.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Seller name <span className="text-red-500">*</span></label>
                    <input maxLength={30} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900" placeholder="Seller name" value={form.name} onChange={(e) => updateField("name", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Shop name <span className="text-red-500">*</span></label>
                    <input maxLength={40} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900" placeholder="Shop name" value={form.shopName} onChange={(e) => updateField("shopName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Email <span className="text-red-500">*</span></label>
                    <input
                      required
                      maxLength={100}
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="Email (e.g. name@domain.com)"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                    {form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email) && (
                      <p className="text-xs font-medium text-red-500 px-1">Enter a valid email address (e.g. name@domain.com)</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Primary phone <span className="text-red-500">*</span></label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-medium text-slate-500 outline-none" placeholder="Primary phone" value={form.phone} readOnly title="Linked from the seller OTP login" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-xs font-bold text-slate-900">Business type <span className="text-red-500">*</span></label>
                    <select required className="w-full truncate rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900" value={form.businessType} onChange={(e) => updateField("businessType", e.target.value)}>
                      <option value="">Select business type</option>
                      {businessTypes.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Alternate phone <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.alternatePhone && form.alternatePhone === form.phone ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="Alternate phone"
                      value={form.alternatePhone}
                      onChange={(e) => updateField("alternatePhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                    {form.alternatePhone && form.alternatePhone === form.phone && (
                      <p className="text-xs font-medium text-red-500 px-1">Alternate number cannot be same as primary number</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-xs font-bold text-slate-900">Service zone <span className="text-red-500">*</span></label>
                    <select
                      required
                      className="w-full truncate rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900"
                      value={`${form.zoneSource}:${form.zoneId}`}
                      onChange={(e) => {
                        const [zoneSource, zoneId] = e.target.value.split(":");
                        setForm((prev) => ({
                          ...prev,
                          zoneSource: zoneSource || "",
                          zoneId: zoneId || "",
                          lat: "",
                          lng: "",
                          address: "",
                        }));
                      }}
                      disabled={zonesLoading}
                    >
                      <option value=":">
                        {zonesLoading ? "Loading zones..." : "Select a service zone"}
                      </option>
                      {zones.map((zone) => {
                        const zoneId = String(zone?._id || zone?.id || "");
                        const zoneSource = String(zone?.source || "");
                        return (
                          <option key={`${zoneSource}-${zoneId}`} value={`${zoneSource}:${zoneId}`}>
                            {zone.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-900">Support email <span className="text-red-500">*</span></label>
                    <input
                      required
                      maxLength={100}
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="Support email (e.g. support@example.com)"
                      type="email"
                      value={form.supportEmail}
                      onChange={(e) => updateField("supportEmail", e.target.value)}
                    />
                    {form.supportEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.supportEmail) && (
                      <p className="text-xs font-medium text-red-500 px-1">Enter a valid email address (e.g. support@example.com)</p>
                    )}
                  </div>
                  {selectedZone ? (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 md:col-span-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">Selected zone</p>
                      <p className="mt-1 text-sm font-medium text-orange-900">
                        {selectedZone.label}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">Opening hours</p>
                        <p className="text-xs font-medium text-slate-500">Select your daily opening and closing time.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {openingHoursPreview}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Opens at</span>
                        <select
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-slate-900"
                          value={hoursDraft.openingTime}
                          onChange={(e) => handleOpeningHoursChange("openingTime", e.target.value)}
                        >
                          <option value="">Select opening time</option>
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {formatTimeTo12Hour(time)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Closes at</span>
                        <select
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-slate-900"
                          value={hoursDraft.closingTime}
                          onChange={(e) => handleOpeningHoursChange("closingTime", e.target.value)}
                        >
                          <option value="">Select closing time</option>
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {formatTimeTo12Hour(time)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveOpeningHours}
                        disabled={isSavingHours}
                        className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isSavingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {isSavingHours ? "Saving..." : "Save Hours"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Store location</p>
                        <p className="text-xs font-medium text-slate-500">Pin your storefront on the map so deliveries route correctly.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-orange-600 active:scale-95 shadow-md shadow-orange-100"
                      >
                        <MapPin className="h-4 w-4" />
                        {form.lat && form.lng ? "Change Pin" : "Pick On Map"}
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Selected address</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                          {form.address || "Choose your store location on the map to auto-fill the address."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Area / Locality</p>
                        <p className="mt-1 font-medium text-slate-700">{selectedZone ? selectedZone.label : "Not selected"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-100 p-3 text-orange-500">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Banking and UPI
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                      Settlement bank account and active UPI address details.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Bank name <span className="text-red-500">*</span></label>
                    <input maxLength={50} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900" placeholder="Bank name" value={form.bankName} onChange={(e) => updateField("bankName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Account holder name <span className="text-red-500">*</span></label>
                    <input maxLength={50} required className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900" placeholder="Account holder name" value={form.accountHolderName} onChange={(e) => updateField("accountHolderName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Account number <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.accountNumber && !/^\d{9,18}$/.test(form.accountNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="Account number (9–18 digits)"
                      value={form.accountNumber}
                      maxLength={18}
                      onChange={(e) => updateField("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))}
                    />
                    {form.accountNumber && !/^\d{9,18}$/.test(form.accountNumber) && (
                      <p className="text-xs font-medium text-red-500 px-1">Account number must be 9–18 digits (numbers only)</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">IFSC code <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium uppercase outline-none focus:border-slate-900 ${form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="IFSC code (e.g. ABCD0EF1234)"
                      value={form.ifscCode}
                      maxLength={11}
                      onChange={(e) => updateField("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                    />
                    {form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) && (
                      <p className="text-xs font-medium text-red-500 px-1">Invalid IFSC: 4 letters + 0 + 6 alphanumeric (e.g. ABCD0EF1234)</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-xs font-bold text-slate-900">Account type <span className="text-red-500">*</span></label>
                    <select
                      required
                      className="w-full truncate rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900"
                      value={form.accountType}
                      onChange={(e) => updateField("accountType", e.target.value)}
                    >
                      <option value="">Select account type</option>
                      <option value="Savings">Savings Account</option>
                      <option value="Current">Current Account</option>
                      <option value="Salary">Salary Account</option>
                      <option value="Fixed Deposit">Fixed Deposit Account</option>
                      <option value="Recurring Deposit">Recurring Deposit Account</option>
                      <option value="NRI">NRI Account (NRE/NRO)</option>
                      <option value="Jan Dhan">Jan Dhan Account</option>
                      <option value="BSBDA">Basic Savings Bank Deposit (BSBDA)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">UPI ID <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="UPI ID (e.g. name@okhdfcbank)"
                      value={form.upiId}
                      onChange={(e) => updateField("upiId", e.target.value)}
                    />
                    {form.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId) && (
                      <p className="text-xs font-medium text-red-500 px-1">Invalid UPI ID. Format: username@bankhandle (e.g. name@okhdfcbank)</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-900">UPI QR image <span className="text-red-500"></span></label>
                    <div
                      onClick={() => setIsQrPickerOpen(true)}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                    >
                      <span className="truncate max-w-[200px]">{qrFile?.name || "Upload UPI QR image"}</span>
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                        <Upload className="h-3.5 w-3.5" />
                        Choose
                      </span>
                    </div>
                    <ImageSourcePicker
                      isOpen={isQrPickerOpen}
                      onClose={() => setIsQrPickerOpen(false)}
                      onFileSelect={setQrFile}
                      title="Upload UPI QR"
                      description="Choose camera or upload from device"
                      fileNamePrefix="upi-qr"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-100 p-3 text-orange-500">
                    <FileBadge2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Compliance and license
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                      Governing registration documents required by platform.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">PAN number <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium uppercase outline-none focus:border-slate-900 ${form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="PAN number (e.g. ABCDE1234F)"
                      value={form.panNumber}
                      maxLength={10}
                      onChange={(e) => updateField("panNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                    />
                    {form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) && (
                      <p className="text-xs font-medium text-red-500 px-1">Invalid PAN format. Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</p>
                    )}
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 font-medium text-slate-700">
                    <input type="checkbox" checked={form.gstRegistered} onChange={(e) => updateField("gstRegistered", e.target.checked)} />
                    GST registered
                  </label>
                  {form.gstRegistered && (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-900">GST number</label>
                        <input
                          className={`w-full rounded-2xl border px-4 py-3 font-medium uppercase outline-none focus:border-slate-900 ${form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                          placeholder="GST number (e.g. 22ABCDE1234F1Z5)"
                          value={form.gstNumber}
                          maxLength={15}
                          onChange={(e) => updateField("gstNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                        />
                        {form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber) && (
                          <p className="text-xs font-medium text-red-500 px-1">Invalid GST format. Must be 15 characters (e.g. 22ABCDE1234F1Z5)</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-900">GST legal name</label>
                        <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-slate-900" placeholder="GST legal name" value={form.gstLegalName} onChange={(e) => updateField("gstLegalName", e.target.value.replace(/[^a-zA-Z\s]/g, ""))} />
                      </div>
                    </>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">FSSAI number</label>
                    <input
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="FSSAI number (14 digits)"
                      value={form.fssaiNumber}
                      maxLength={14}
                      onChange={(e) => updateField("fssaiNumber", e.target.value.replace(/\D/g, "").slice(0, 14))}
                    />
                    {form.fssaiNumber && !/^\d{14}$/.test(form.fssaiNumber) && (
                      <p className="text-xs font-medium text-red-500 px-1">FSSAI number must be exactly 14 digits (numbers only)</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">FSSAI expiry date</label>
                    <input
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      type="date"
                      value={form.fssaiExpiry}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => updateField("fssaiExpiry", e.target.value)}
                    />
                    {form.fssaiExpiry && form.fssaiExpiry < new Date().toISOString().split("T")[0] && (
                      <p className="text-xs font-medium text-red-500 px-1">FSSAI expiry date cannot be a past date</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Shop license number <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="Shop license number (e.g. MH/2023/12345)"
                      value={form.shopLicenseNumber}
                      maxLength={20}
                      onChange={(e) => updateField("shopLicenseNumber", e.target.value.replace(/[^A-Za-z0-9\/\-]/g, "").slice(0, 20))}
                    />
                    {form.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(form.shopLicenseNumber) && (
                      <p className="text-xs font-medium text-red-500 px-1">License number must be 5–20 characters (letters, numbers, / and - only)</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-900">Shop license expiry date <span className="text-red-500">*</span></label>
                    <input
                      required
                      className={`w-full rounded-2xl border px-4 py-3 font-medium outline-none focus:border-slate-900 ${form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      type="date"
                      value={form.shopLicenseExpiry}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => updateField("shopLicenseExpiry", e.target.value)}
                    />
                    {form.shopLicenseExpiry && form.shopLicenseExpiry < new Date().toISOString().split("T")[0] && (
                      <p className="text-xs font-medium text-red-500 px-1">Shop license expiry date cannot be a past date</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-900">Shop license image <span className="text-red-500">*</span></label>
                    <div
                      onClick={() => setIsLicensePickerOpen(true)}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                    >
                      <span className="truncate max-w-[200px]">{licenseFile?.name || "Upload shop license image"}</span>
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-500 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white">
                        <Upload className="h-3.5 w-3.5" />
                        Choose
                      </span>
                    </div>
                    <ImageSourcePicker
                      isOpen={isLicensePickerOpen}
                      onClose={() => setIsLicensePickerOpen(false)}
                      onFileSelect={setLicenseFile}
                      title="Upload Shop License"
                      description="Choose camera or upload from device"
                      fileNamePrefix="shop-license"
                    />
                  </div>
                </div>

                {feeConfig && !isReonboardBypass && feeConfig.isActive && feeConfig.price > 0 && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 mt-4 mb-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-600">
                      Required Onboarding Fee
                    </p>
                    <p className="mt-2 text-2xl font-black text-orange-900">₹{feeConfig.price}</p>
                    <p className="mt-2 text-xs font-medium text-orange-700">
                      An onboarding fee is required to submit your seller registration.
                      You will be prompted to make a secure payment via Razorpay.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
              <p className="max-w-xl text-[11px] font-medium leading-5 text-slate-400">
                Step {currentStep} of 3. Ensure all fields marked with * are filled correctly before proceeding.
              </p>

              <div className="flex items-center justify-between gap-3 w-full">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => prev - 1)}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-slate-700 transition hover:bg-slate-200 active:scale-95"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1 && validateStep1()) {
                        setCurrentStep(2);
                      } else if (currentStep === 2 && validateStep2()) {
                        setCurrentStep(3);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-white transition hover:bg-orange-600 active:scale-95 shadow-md shadow-orange-100"
                  >
                    Next Step
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95 shadow-md shadow-orange-100"
                  >
                    {isSubmitting ? "Submitting..." : "Submit for approval"}
                    {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </motion.form>
        </div>
      </div>


      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={initialLocation}
          initialRadius={Number(form.radius) || 5}
          maxRadius={100}
          zoneCoordinates={selectedZone?.coordinates || []}
          zoneLabel={selectedZone?.label || ""}
        />
      )}

      <ImageSourcePicker
        isOpen={sourcePicker.isOpen}
        onClose={closeImageSourcePicker}
        onFileSelect={sourcePicker.onSelectFile}
        title={sourcePicker.title}
        fileNamePrefix={sourcePicker.fileNamePrefix}
        galleryInputRef={sourcePicker.fallbackInputRef}
      />
    </div>
  );
}



