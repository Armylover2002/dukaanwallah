import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Image, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../services/adminApi";
import IconSelector from "@shared/components/IconSelector";
import { getIconSvg } from "@shared/constants/categoryIcons";

// MUI icon library (shared with customer app & icon selector)
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SpaIcon from "@mui/icons-material/Spa";
import ToysIcon from "@mui/icons-material/Toys";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import YardIcon from "@mui/icons-material/Yard";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import DiamondIcon from "@mui/icons-material/Diamond";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import BuildIcon from "@mui/icons-material/Build";
import LuggageIcon from "@mui/icons-material/Luggage";
import ChairIcon from "@mui/icons-material/Chair";
import BlenderIcon from "@mui/icons-material/Blender";
import BakeryDiningIcon from "@mui/icons-material/BakeryDining";
import LocalBarIcon from "@mui/icons-material/LocalBar";
import TwoWheelerIcon from "@mui/icons-material/TwoWheeler";
import PedalBikeIcon from "@mui/icons-material/PedalBike";
import MedicationIcon from "@mui/icons-material/Medication";
import EditNoteIcon from "@mui/icons-material/EditNote";
import HardwareIcon from "@mui/icons-material/Hardware";
import ConstructionIcon from "@mui/icons-material/Construction";
import ElectricalServicesIcon from "@mui/icons-material/ElectricalServices";
import FlightIcon from "@mui/icons-material/Flight";
import LocalFloristIcon from "@mui/icons-material/LocalFlorist";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import LaptopIcon from "@mui/icons-material/Laptop";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import WatchIcon from "@mui/icons-material/Watch";

const iconComponents = {
  electronics: DevicesIcon,
  fashion: CheckroomIcon,
  home: HomeIcon,
  furniture: ChairIcon,
  kitchen: KitchenIcon,
  appliances: BlenderIcon,
  food: LocalCafeIcon,
  grocery: LocalGroceryStoreIcon,
  bakery: BakeryDiningIcon,
  drinks: LocalBarIcon,
  sports: SportsSoccerIcon,
  books: MenuBookIcon,
  beauty: SpaIcon,
  toys: ToysIcon,
  automotive: DirectionsCarIcon,
  motorcycle: TwoWheelerIcon,
  bicycle: PedalBikeIcon,
  pets: PetsIcon,
  health: LocalHospitalIcon,
  pharmacy: MedicationIcon,
  garden: YardIcon,
  office: BusinessCenterIcon,
  stationery: EditNoteIcon,
  music: MusicNoteIcon,
  jewelry: DiamondIcon,
  baby: ChildCareIcon,
  tools: BuildIcon,
  hardware: HardwareIcon,
  construction: ConstructionIcon,
  electrical: ElectricalServicesIcon,
  luggage: LuggageIcon,
  travel: FlightIcon,
  gifts: CardGiftcardIcon,
  art: ColorLensIcon,
  flowers: LocalFloristIcon,
  cleaning: CleaningServicesIcon,
  gaming: SportsEsportsIcon,
  mobile: SmartphoneIcon,
  laptop: LaptopIcon,
  camera: PhotoCameraIcon,
  watches: WatchIcon,
};

const CategoryWizardModal = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [createdHeaderId, setCreatedHeaderId] = useState(null);
  const [createdLevel2Id, setCreatedLevel2Id] = useState(null);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [selectedExistingHeaderId, setSelectedExistingHeaderId] = useState("");
  const [level2Categories, setLevel2Categories] = useState([]);
  const [selectedExistingLevel2Id, setSelectedExistingLevel2Id] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchHeaderCategories = async () => {
        try {
          const res = await adminApi.getCategories({ type: 'header', limit: 100 });
          setHeaderCategories(res.data?.results || res.data?.result?.items || []);
        } catch (error) {
          console.error("Failed to fetch header categories", error);
        }
      };
      fetchHeaderCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && step === 2 && selectedExistingHeaderId) {
      const fetchLevel2Categories = async () => {
        try {
          const res = await adminApi.getCategories({ type: 'category', parentId: selectedExistingHeaderId, limit: 100 });
          setLevel2Categories(res.data?.results || res.data?.result?.items || []);
        } catch (error) {
          console.error("Failed to fetch level 2 categories", error);
        }
      };
      fetchLevel2Categories();
    } else if (step === 2 && !selectedExistingHeaderId) {
      setLevel2Categories([]);
    }
  }, [isOpen, step, selectedExistingHeaderId]);

  const [headerForm, setHeaderForm] = useState({
    name: "", slug: "", description: "", status: "active", type: "header",
    parentId: null, iconId: "", adminCommission: 0, handlingFees: 0, headerColor: "#FF1E1E",
  });
  const [headerImage, setHeaderImage] = useState(null);
  const [headerPreview, setHeaderPreview] = useState(null);
  const headerFileRef = useRef(null);

  const [level2Form, setLevel2Form] = useState({
    name: "", slug: "", description: "", status: "active", type: "category", parentId: "",
  });
  const [level2Image, setLevel2Image] = useState(null);
  const [level2Preview, setLevel2Preview] = useState(null);
  const level2FileRef = useRef(null);

  const [subForm, setSubForm] = useState({
    name: "", slug: "", description: "", status: "active", type: "subcategory", parentId: "",
  });
  const [subImage, setSubImage] = useState(null);
  const [subPreview, setSubPreview] = useState(null);
  const subFileRef = useRef(null);

  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);

  const handleImageChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const resetWizard = () => {
    setStep(1);
    setCreatedHeaderId(null);
    setCreatedLevel2Id(null);
    setSelectedExistingHeaderId("");
    setSelectedExistingLevel2Id("");
    setHeaderForm({ name: "", slug: "", description: "", status: "active", type: "header", parentId: null, iconId: "", adminCommission: 0, handlingFees: 0, headerColor: "#FF1E1E" });
    setLevel2Form({ name: "", slug: "", description: "", status: "active", type: "category", parentId: "" });
    setSubForm({ name: "", slug: "", description: "", status: "active", type: "subcategory", parentId: "" });
    setHeaderImage(null); setHeaderPreview(null);
    setLevel2Image(null); setLevel2Preview(null);
    setSubImage(null); setSubPreview(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleSaveHeader = async () => {
    if (!selectedExistingHeaderId) {
      if (!headerForm.name || !headerForm.slug) {
        toast.error("Name and slug are required");
        return;
      }
      if (!headerForm.iconId && !headerImage) {
        toast.error("Please select an icon or upload an image");
        return;
      }
      if (parseFloat(headerForm.adminCommission) > 100) {
        toast.error("Admin commission cannot exceed 100%");
        return;
      }
    }
    setStep(2);
  };

  const handleSaveLevel2 = async () => {
    if (!selectedExistingLevel2Id) {
      if (!level2Form.name || !level2Form.slug) {
        toast.error("Name and slug are required");
        return;
      }
      if (!level2Image) {
        toast.error("Please upload an image");
        return;
      }
    }
    setStep(3);
  };

  const handleSaveSub = async () => {
    if (!subForm.name || !subForm.slug) {
      toast.error("Name and slug are required");
      return;
    }
    if (!subImage) {
      toast.error("Please upload an image");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Create Header
      let headerId = selectedExistingHeaderId;
      if (!headerId) {
        const headerData = new FormData();
        headerData.append("type", "header");
        Object.keys(headerForm).forEach((key) => {
          if (key !== "type" && key !== "parentId") {
            let value = headerForm[key];
            if (key === "adminCommission" || key === "handlingFees") {
              value = parseFloat(value) || 0;
            }
            headerData.append(key, value);
          }
        });
        if (headerImage) headerData.append("image", headerImage);

        const headerRes = await adminApi.createCategory(headerData);
        const newHeader = headerRes.data?.result || headerRes.data?.category || headerRes.data?.data;
        headerId = newHeader?._id || newHeader?.id;
        
        if (!headerId) throw new Error("Could not retrieve created Header ID");
      }
      setCreatedHeaderId(headerId); // For completeness

      // 2. Create Level 2
      let level2Id = selectedExistingLevel2Id;
      if (!level2Id) {
        const level2Data = new FormData();
        level2Data.append("type", "category");
        level2Data.append("parentId", headerId);
        Object.keys(level2Form).forEach((key) => {
          if (key !== "type" && key !== "parentId") {
            level2Data.append(key, level2Form[key]);
          }
        });
        if (level2Image) level2Data.append("image", level2Image);

        const level2Res = await adminApi.createCategory(level2Data);
        const newLevel2 = level2Res.data?.result || level2Res.data?.category || level2Res.data?.data;
        level2Id = newLevel2?._id || newLevel2?.id;
        
        if (!level2Id) throw new Error("Could not retrieve created Level 2 ID");
      }
      setCreatedLevel2Id(level2Id);

      // 3. Create Subcategory
      const subData = new FormData();
      subData.append("type", "subcategory");
      subData.append("parentId", level2Id);
      Object.keys(subForm).forEach((key) => {
        if (key !== "type" && key !== "parentId") {
          subData.append(key, subForm[key]);
        }
      });
      if (subImage) subData.append("image", subImage);

      await adminApi.createCategory(subData);
      
      toast.success("Category hierarchy created successfully!");
      if (onComplete) onComplete();
      handleClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to create category hierarchy");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100 flex flex-col shrink-0 relative">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-gray-900">
                {step === 1 && "Add Header Category"}
                {step === 2 && "Add Category"}
                {step === 3 && "Add Subcategory"}
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="text-sm font-medium text-indigo-600">
              Step {step} of 3 – {step === 1 ? "Add Header Category" : step === 2 ? "Add Main Category" : "Add Sub Category"}
            </div>
            
            <div className="w-full bg-gray-200 h-1 mt-2 rounded">
              <div 
                className="bg-indigo-600 h-1 rounded transition-all duration-300" 
                style={{ width: `${(step / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          <div
            className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y"
            tabIndex={0}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {step === 1 && (
              <>
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium text-gray-700">
                    Select Existing Header Category
                  </label>
                  <select
                    value={selectedExistingHeaderId}
                    onChange={(e) => setSelectedExistingHeaderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">-- Create New Header Category --</option>
                    {headerCategories.map((cat, index) => (
                      <option key={cat._id || cat.id || `header-${index}`} value={cat._id || cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedExistingHeaderId && (
                  <>
                    {/* Icon/Image Selection */}
                    {/* Icon Selection */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-24 h-24 rounded-full bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 flex items-center justify-center">
                          {headerForm.iconId && iconComponents[headerForm.iconId] ? (
                            <div className="w-12 h-12 text-indigo-600 flex items-center justify-center">
                              {(() => {
                                const IconComp = iconComponents[headerForm.iconId];
                                return <IconComp fontSize="large" />;
                              })()}
                            </div>
                          ) : headerForm.iconId && getIconSvg(headerForm.iconId) ? (
                            <div
                              className="w-12 h-12 text-indigo-600"
                              dangerouslySetInnerHTML={{
                                __html: getIconSvg(headerForm.iconId),
                              }}
                            />
                          ) : (
                            <Sparkles className="w-10 h-10 text-indigo-300" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsIconSelectorOpen(true)}
                          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                          {headerForm.iconId ? 'Change Icon' : 'Select Icon'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Choose an SVG icon for this category
                      </p>
                    </div>

                {/* Header Color Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Header Color
                    </label>
                    <span className="text-xs text-gray-400">
                      Used for this header&apos;s theme
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex-1 h-10 rounded-lg border border-gray-200 shadow-inner"
                      style={{
                        background: headerForm.headerColor || "#FF1E1E",
                      }}
                    />
                    <input
                      type="color"
                      value={headerForm.headerColor || "#FF1E1E"}
                      onChange={(e) =>
                        setHeaderForm({ ...headerForm, headerColor: e.target.value })
                      }
                      className="w-12 h-10 rounded-md border border-gray-300 cursor-pointer bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={headerForm.headerColor || "#FF1E1E"}
                      onChange={(e) =>
                        setHeaderForm({ ...headerForm, headerColor: e.target.value })
                      }
                      className="w-28 px-2 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="#FF1E1E"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={headerForm.name}
                    onChange={(e) =>
                      setHeaderForm({ ...headerForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., Electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={headerForm.slug}
                    onChange={(e) =>
                      setHeaderForm({ ...headerForm, slug: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., electronics"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={headerForm.status}
                    onChange={(e) =>
                      setHeaderForm({ ...headerForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Admin Commission (%)
                    </label>
                    <input
                      type="number"
                      value={headerForm.adminCommission}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val !== "" && parseFloat(val) > 100) val = "100";
                        setHeaderForm({ ...headerForm, adminCommission: val });
                      }}
                      onFocus={(e) => {
                        if (parseFloat(e.target.value) === 0) setHeaderForm({ ...headerForm, adminCommission: "" });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "") setHeaderForm({ ...headerForm, adminCommission: 0 });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="0" min="0" max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Handling Fees (₹)
                    </label>
                    <input
                      type="number"
                      value={headerForm.handlingFees}
                      onChange={(e) =>
                        setHeaderForm({ ...headerForm, handlingFees: e.target.value })
                      }
                      onFocus={(e) => {
                        if (parseFloat(e.target.value) === 0) setHeaderForm({ ...headerForm, handlingFees: "" });
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "") setHeaderForm({ ...headerForm, handlingFees: 0 });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="0" min="0"
                    />
                  </div>
                </div>
              </>
              )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium text-gray-700">
                    Parent Header Category
                  </label>
                  <select
                    value="pending"
                    disabled
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-600 focus:outline-none">
                    <option key="pending-header" value="pending">
                      {selectedExistingHeaderId 
                        ? (headerCategories.find(c => (c._id || c.id) === selectedExistingHeaderId)?.name || "Selected Header") 
                        : (headerForm.name || "Pending Creation")}
                    </option>
                  </select>
                </div>

                {selectedExistingHeaderId && (
                  <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium text-gray-700">
                      Select Existing Main Category
                    </label>
                    <select
                      value={selectedExistingLevel2Id}
                      onChange={(e) => setSelectedExistingLevel2Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="">-- Create New Main Category --</option>
                      {level2Categories.map((cat, index) => (
                        <option key={cat._id || cat.id || `level2-${index}`} value={cat._id || cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!selectedExistingLevel2Id && (
                  <>
                    <div className="flex justify-center">
                  <div
                    onClick={() => level2FileRef.current?.click()}
                    className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden transition-colors">
                    {level2Preview ? (
                      <img
                        src={level2Preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-500 mt-1">Upload</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={level2FileRef}
                    className="hidden"
                    onChange={(e) => handleImageChange(e, setLevel2Image, setLevel2Preview)}
                    accept="image/*"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Parent Header Category
                  </label>
                  <select
                    value="pending"
                    disabled
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-600 focus:outline-none">
                    <option key="pending-header" value="pending">{headerForm.name || "Pending Creation"}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={level2Form.name}
                    onChange={(e) =>
                      setLevel2Form({ ...level2Form, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., Laptops"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={level2Form.slug}
                    onChange={(e) =>
                      setLevel2Form({ ...level2Form, slug: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., laptops"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={level2Form.status}
                    onChange={(e) =>
                      setLevel2Form({ ...level2Form, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="active">Active</option>
                  </select>
                </div>
              </>
              )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium text-gray-700">
                    Parent Category (Level 2)
                  </label>
                  <select
                    value="pending"
                    disabled
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-600 focus:outline-none">
                    <option key="pending-level2" value="pending">
                      {selectedExistingHeaderId 
                        ? (headerCategories.find(c => (c._id || c.id) === selectedExistingHeaderId)?.name || "Selected Header") 
                        : (headerForm.name || "Pending Creation")} 
                      {" > "} 
                      {selectedExistingLevel2Id 
                        ? (level2Categories.find(c => (c._id || c.id) === selectedExistingLevel2Id)?.name || "Selected Category") 
                        : (level2Form.name || "Pending Creation")}
                    </option>
                  </select>
                </div>

                <div className="flex justify-center">
                  <div
                    onClick={() => subFileRef.current?.click()}
                    className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden transition-colors">
                    {subPreview ? (
                      <img
                        src={subPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-500 mt-1">Upload</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={subFileRef}
                    className="hidden"
                    onChange={(e) => handleImageChange(e, setSubImage, setSubPreview)}
                    accept="image/*"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={subForm.name}
                    onChange={(e) =>
                      setSubForm({ ...subForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., Gaming Laptops"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={subForm.slug}
                    onChange={(e) =>
                      setSubForm({ ...subForm, slug: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g., gaming-laptops"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={subForm.status}
                    onChange={(e) =>
                      setSubForm({ ...subForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium mr-auto">
                Back
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
              Cancel
            </button>
            {step === 1 && (
              <button
                onClick={handleSaveHeader}
                disabled={isSaving}
                className="px-4 py-2 bg-[#d95325] text-white rounded-lg hover:bg-[#c0461f] font-medium disabled:opacity-50 flex items-center gap-2">
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {selectedExistingHeaderId ? "Next Step" : "Create Header"}
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleSaveLevel2}
                disabled={isSaving}
                className="px-4 py-2 bg-[#d95325] text-white rounded-lg hover:bg-[#c0461f] font-medium disabled:opacity-50 flex items-center gap-2">
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {selectedExistingLevel2Id ? "Next Step" : "Create Category"}
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleSaveSub}
                disabled={isSaving}
                className="px-4 py-2 bg-[#d95325] text-white rounded-lg hover:bg-[#c0461f] font-medium disabled:opacity-50 flex items-center gap-2">
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Create Subcategory
              </button>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isIconSelectorOpen && (
          <IconSelector
            selectedIcon={headerForm.iconId}
            onSelect={(iconId) => {
              setHeaderForm({ ...headerForm, iconId });
              setIsIconSelectorOpen(false);
            }}
            onClose={() => setIsIconSelectorOpen(false)}
          />
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default CategoryWizardModal;
