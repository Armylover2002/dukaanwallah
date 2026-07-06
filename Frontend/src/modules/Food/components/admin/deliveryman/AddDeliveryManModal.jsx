import { useState } from "react"
import { Upload, Calendar, Eye, EyeOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

// ---- Validation helpers ----
const NAME_REGEX = /^[A-Za-z\s'-]+$/ // letters, spaces, apostrophe, hyphen only (no digits/special chars)
const ONLY_DIGITS_REGEX = /^[0-9]+$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/ // standard PAN format e.g. ABCDE1234F
const AADHAR_REGEX = /^[0-9]{12}$/ // 12 digit Aadhaar
const DL_REGEX = /^[A-Z0-9-]{6,20}$/ // alphanumeric DL, no spaces/special chars other than hyphen
const VEHICLE_NUMBER_REGEX = /^[A-Z0-9\s-]{4,15}$/ // alphanumeric vehicle number
const VEHICLE_NAME_REGEX = /^[A-Za-z0-9\s'-]*$/ // letters/numbers/spaces (bike brand+model), optional field
const PHONE_REGEX = /^[6-9][0-9]{9}$/ // valid 10-digit Indian mobile number (starts 6-9)

// Strict-ish email regex:
// - local part: letters, digits, . _ % + -
// - domain: letters/digits/hyphen labels separated by dots
// - TLD: 2 to 6 letters only (blocks "commmmm", but note this ALSO blocks new-ish TLDs > 6 chars if you have any)
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,6}$/

// Known-valid common TLDs. This is used to catch typos like "gmail.co" or "gmail.commmmm"
// that pass the general regex but aren't real TLDs.
const COMMON_VALID_TLDS = new Set([
  "com", "in", "org", "net", "edu", "gov", "co", "io", "info", "biz",
  "us", "uk", "ca", "au", "de", "fr", "jp", "cn", "ru", "br",
])

// Domains where we validate the TLD strictly against a small whitelist of correct suffixes,
// to catch common typos (gmail.co, gmail.commmmm, yahoo.con, etc.)
const KNOWN_EMAIL_DOMAINS = {
  "gmail.com": true,
  "yahoo.com": true,
  "outlook.com": true,
  "hotmail.com": true,
  "icloud.com": true,
  "rediffmail.com": true,
}

function isValidEmail(email) {
  const trimmed = email.trim()
  if (!EMAIL_REGEX.test(trimmed)) return false

  const [, domainPart] = trimmed.split("@")
  if (!domainPart) return false

  const domainLower = domainPart.toLowerCase()

  // If it looks like a well-known provider domain but doesn't exactly match
  // (e.g. gmail.co, gmail.commmmm, gmail.con), reject it.
  const baseName = domainLower.split(".")[0] // "gmail" from "gmail.commmmm"
  const knownFullDomain = Object.keys(KNOWN_EMAIL_DOMAINS).find((d) => d.startsWith(baseName + "."))
  if (knownFullDomain && domainLower !== knownFullDomain) {
    return false
  }

  // General TLD sanity check: last label should be a plausible TLD (2-6 letters)
  const labels = domainLower.split(".")
  const tld = labels[labels.length - 1]
  if (!/^[a-z]{2,6}$/.test(tld)) return false

  return true
}

function blockDigitsKeyDown(e) {
  // Prevent typing digits directly in name-like fields
  if (/[0-9]/.test(e.key)) {
    e.preventDefault()
  }
}

function blockLettersKeyDown(e) {
  // Allow control keys (backspace, arrows, tab, delete) but block letters/symbols
  const allowedControlKeys = [
    "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "Tab", "Home", "End",
  ]
  if (allowedControlKeys.includes(e.key)) return
  if (!/[0-9]/.test(e.key)) {
    e.preventDefault()
  }
}

export default function AddDeliveryManModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    vehicleType: "",
    vehicleName: "",
    vehicleNumber: "",
    panNumber: "",
    aadharNumber: "",
    drivingLicenseNumber: "",
    panPhoto: null,
    aadharPhoto: null,
    drivingLicensePhoto: null,
    phone: "+91",
  })

  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const errors = {}

    // ---- Name fields: required, letters only ----
    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required"
    } else if (!NAME_REGEX.test(formData.firstName.trim())) {
      errors.firstName = "First name can only contain letters"
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required"
    } else if (!NAME_REGEX.test(formData.lastName.trim())) {
      errors.lastName = "Last name can only contain letters"
    }

    // ---- Email: required, strict format + known-domain TLD check ----
    if (!formData.email.trim()) {
      errors.email = "Email is required"
    } else if (!isValidEmail(formData.email)) {
      errors.email = "Invalid email format"
    }

    // ---- Phone: required, 10 digit Indian mobile ----
    const phoneDigits = formData.phone.replace("+91", "").trim()
    if (!phoneDigits) {
      errors.phone = "Phone number is required"
    } else if (!PHONE_REGEX.test(phoneDigits)) {
      errors.phone = "Enter a valid 10-digit mobile number"
    }

    // ---- Vehicle type ----
    if (!formData.vehicleType) errors.vehicleType = "Vehicle type is required"

    // ---- Vehicle name: optional, but if provided must not contain weird symbols ----
    if (formData.vehicleName && !VEHICLE_NAME_REGEX.test(formData.vehicleName.trim())) {
      errors.vehicleName = "Vehicle name contains invalid characters"
    }

    // ---- Vehicle number: required, alphanumeric format ----
    if (!formData.vehicleNumber.trim()) {
      errors.vehicleNumber = "Vehicle number is required"
    } else if (!VEHICLE_NUMBER_REGEX.test(formData.vehicleNumber.trim().toUpperCase())) {
      errors.vehicleNumber = "Enter a valid vehicle number (e.g. MH12AB1234)"
    }

    // ---- PAN: required, match PAN format ----
    if (!formData.panNumber || !formData.panNumber.trim()) {
      errors.panNumber = "PAN number is required"
    } else if (!PAN_REGEX.test(formData.panNumber.trim().toUpperCase())) {
      errors.panNumber = "Enter a valid PAN number (e.g. ABCDE1234F)"
    }

    // ---- Aadhaar: required, exactly 12 digits ----
    if (!formData.aadharNumber || !formData.aadharNumber.trim()) {
      errors.aadharNumber = "Aadhaar number is required"
    } else if (!ONLY_DIGITS_REGEX.test(formData.aadharNumber.trim())) {
      errors.aadharNumber = "Aadhaar number must contain digits only"
    } else if (!AADHAR_REGEX.test(formData.aadharNumber.trim())) {
      errors.aadharNumber = "Aadhaar number must be exactly 12 digits"
    }

    // ---- Driving Licence: required, alphanumeric ----
    if (!formData.drivingLicenseNumber || !formData.drivingLicenseNumber.trim()) {
      errors.drivingLicenseNumber = "Driving licence number is required"
    } else if (!DL_REGEX.test(formData.drivingLicenseNumber.trim().toUpperCase())) {
      errors.drivingLicenseNumber = "Enter a valid driving licence number"
    }

    // ---- Document Photos: required ----
    if (!formData.panPhoto) {
      errors.panPhoto = "PAN Card image is required"
    }
    if (!formData.aadharPhoto) {
      errors.aadharPhoto = "Aadhaar Card image is required"
    }
    if (!formData.drivingLicensePhoto) {
      errors.drivingLicensePhoto = "Driving Licence image is required"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) {
      toast.error("Please fix the validation errors in the form")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = new FormData();
      payload.append('name', `${formData.firstName} ${formData.lastName}`.trim());
      payload.append('email', formData.email.trim());
      payload.append('phone', formData.phone);
      payload.append('vehicleType', formData.vehicleType);
      if (formData.vehicleName) payload.append('vehicleName', formData.vehicleName.trim());
      payload.append('vehicleNumber', formData.vehicleNumber.trim().toUpperCase());

      if (formData.panNumber) payload.append('panNumber', formData.panNumber.trim().toUpperCase());
      if (formData.aadharNumber) payload.append('aadharNumber', formData.aadharNumber.trim());
      if (formData.drivingLicenseNumber) payload.append('drivingLicenseNumber', formData.drivingLicenseNumber.trim().toUpperCase());

      if (formData.panPhoto) payload.append('panPhoto', formData.panPhoto);
      if (formData.aadharPhoto) payload.append('aadharPhoto', formData.aadharPhoto);
      if (formData.drivingLicensePhoto) payload.append('drivingLicensePhoto', formData.drivingLicensePhoto);

      await adminAPI.addDeliveryPartner(payload)
      toast.success("Delivery partner added successfully!")
      handleReset()
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error("Error adding delivery partner:", error)
      toast.error(error?.response?.data?.message || "Failed to add delivery partner")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      vehicleType: "",
      vehicleName: "",
      vehicleNumber: "",
      panNumber: "",
      aadharNumber: "",
      drivingLicenseNumber: "",
      panPhoto: null,
      aadharPhoto: null,
      drivingLicensePhoto: null,
      phone: "+91",
    })
    setFormErrors({})
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-white z-10">
          <DialogTitle className="text-xl font-bold text-slate-900">Add New Delivery Man</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6">
          {/* 1. General info */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">1. General info</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  onKeyDown={blockDigitsKeyDown}
                  placeholder="Ex: Jhone"
                  maxLength={50}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.firstName ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.firstName && <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  onKeyDown={blockDigitsKeyDown}
                  placeholder="Ex: Joe"
                  maxLength={50}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.lastName ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.lastName && <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Ex: ex@example.com"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.email ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2.5 border border-slate-300 rounded-l-lg bg-slate-50 text-sm">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={formData.phone.replace("+91", "")}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10)
                      handleInputChange("phone", "+91" + digitsOnly)
                    }}
                    onKeyDown={blockLettersKeyDown}
                    placeholder="Enter phone number"
                    maxLength={10}
                    className={`flex-1 px-4 py-2.5 border border-l-0 rounded-r-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${formErrors.phone ? "border-red-500" : "border-slate-300"
                      }`}
                  />
                </div>
                {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
              </div>
            </div>
          </div>

          {/* 2. Identification Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">2. Identification & Vehicle Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => handleInputChange("vehicleType", e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.vehicleType ? "border-red-500" : "border-slate-300"
                    }`}
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="cycle">Cycle</option>
                </select>
                {formErrors.vehicleType && <p className="text-xs text-red-500 mt-1">{formErrors.vehicleType}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Vehicle Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.vehicleName}
                  onChange={(e) => handleInputChange("vehicleName", e.target.value)}
                  placeholder="Ex: Honda Activa"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${formErrors.vehicleName ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.vehicleName && <p className="text-xs text-red-500 mt-1">{formErrors.vehicleName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Vehicle Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vehicleNumber}
                  onChange={(e) => handleInputChange("vehicleNumber", e.target.value.toUpperCase())}
                  placeholder="Ex: MH12AB1234"
                  maxLength={15}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${formErrors.vehicleNumber ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.vehicleNumber && <p className="text-xs text-red-500 mt-1">{formErrors.vehicleNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  PAN Card Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.panNumber}
                  onChange={(e) => handleInputChange("panNumber", e.target.value.toUpperCase())}
                  placeholder="Ex: ABCDE1234F"
                  maxLength={10}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${formErrors.panNumber ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.panNumber && <p className="text-xs text-red-500 mt-1">{formErrors.panNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Aadhaar Card Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.aadharNumber}
                  onChange={(e) => handleInputChange("aadharNumber", e.target.value.replace(/\D/g, ""))}
                  onKeyDown={blockLettersKeyDown}
                  placeholder="Enter 12-digit Aadhaar Number"
                  maxLength={12}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${formErrors.aadharNumber ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.aadharNumber && <p className="text-xs text-red-500 mt-1">{formErrors.aadharNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Driving Licence Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.drivingLicenseNumber}
                  onChange={(e) => handleInputChange("drivingLicenseNumber", e.target.value.toUpperCase())}
                  placeholder="Enter Driving Licence Number"
                  maxLength={20}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${formErrors.drivingLicenseNumber ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.drivingLicenseNumber && <p className="text-xs text-red-500 mt-1">{formErrors.drivingLicenseNumber}</p>}
              </div>
            </div>
          </div>

          {/* 3. Upload Documents */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">3. Upload Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Upload PAN Card <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleInputChange("panPhoto", e.target.files[0])}
                  className={`w-full px-4 py-2 border rounded-lg bg-white text-sm ${formErrors.panPhoto ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.panPhoto && <p className="text-xs text-red-500 mt-1">{formErrors.panPhoto}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Upload Aadhaar Card <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleInputChange("aadharPhoto", e.target.files[0])}
                  className={`w-full px-4 py-2 border rounded-lg bg-white text-sm ${formErrors.aadharPhoto ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.aadharPhoto && <p className="text-xs text-red-500 mt-1">{formErrors.aadharPhoto}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Upload Driving Licence <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleInputChange("drivingLicensePhoto", e.target.files[0])}
                  className={`w-full px-4 py-2 border rounded-lg bg-white text-sm ${formErrors.drivingLicensePhoto ? "border-red-500" : "border-slate-300"
                    }`}
                />
                {formErrors.drivingLicensePhoto && <p className="text-xs text-red-500 mt-1">{formErrors.drivingLicensePhoto}</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 sticky bottom-0 bg-white pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}