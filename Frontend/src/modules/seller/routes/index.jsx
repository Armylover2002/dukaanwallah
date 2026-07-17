import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { useAuth } from "@core/context/AuthContext";
import Orders from "../pages/Orders";
import { useQCReturnCount } from "../context/useQCReturnCount";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlineTag,
  HiOutlineInbox,
  HiOutlineBuildingLibrary
} from "react-icons/hi2";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
const Returns = React.lazy(() => import("../pages/Returns"));
const ReturnOrders = React.lazy(() => import("../pages/ReturnOrders"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const BankDetails = React.lazy(() => import("../pages/BankDetails"));
const Onboarding = React.lazy(() => import("../pages/Onboarding"));
const PendingApproval = React.lazy(() => import("../pages/PendingApproval"));
const Coupons = React.lazy(() => import("../pages/Coupons"));
const CODDepositRequests = React.lazy(() => import("../pages/CODDepositRequests"));

import ChatbotWidget from '@/components/Chatbot/ChatbotWidget';

const BASE_NAV_ITEMS = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Stock", path: "/seller/inventory", icon: HiOutlineArchiveBox },
  { label: "Orders", path: "/seller/orders", icon: HiOutlineTruck },
  // { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "QC Returns", path: "/seller/return-orders", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Sales Reports",
    path: "/seller/analytics",
    icon: HiOutlineChartBarSquare,
  },
  {
    label: "Money Request",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "COD Deposit Requests",
    path: "/seller/cod-deposits",
    icon: HiOutlineInbox,
  },
  {
    label: "Payment History",
    path: "/seller/transactions",
    icon: HiOutlineCreditCard,
  },
  {
    label: "Bank Details",
    path: "/seller/bank-details",
    icon: HiOutlineBuildingLibrary,
  },
  {
    label: "Coupons",
    path: "/seller/coupons",
    icon: HiOutlineTag,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
];

import { AppShellSkeleton } from '@food/components/ui/loading-skeletons';

const Loader = () => <AppShellSkeleton />;

function SellerWorkspace() {
  const { count: qcReturnCount } = useQCReturnCount();

  const navItems = useMemo(
    () =>
      BASE_NAV_ITEMS.map((item) =>
        item.path === "/seller/return-orders" && qcReturnCount > 0
          ? { ...item, badge: qcReturnCount }
          : item,
      ),
    [qcReturnCount],
  );

  return (
    <DashboardLayout navItems={navItems} title="Seller Panel">
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductManagement />} />
        <Route path="products/add" element={<AddProduct />} />
        <Route path="inventory" element={<StockManagement />} />
        <Route path="orders" element={<Orders />} />
        <Route path="returns" element={<Returns />} />
        <Route path="return-orders" element={<ReturnOrders />} />
        <Route path="tracking" element={<DeliveryTracking />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="cod-deposits" element={<CODDepositRequests />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="withdrawals" element={<Withdrawals />} />
        <Route path="bank-details" element={<BankDetails />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/seller" replace />} />
      </Routes>
      <ChatbotWidget module="seller" />
    </DashboardLayout>
  );
}

const SellerAccessRouter = () => {
  const { user, refreshUser } = useAuth();
  const [isChecking, setIsChecking] = useState(!user);

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      if (user) {
        setIsChecking(false);
        return;
      }

      try {
        await refreshUser();
      } finally {
        if (alive) setIsChecking(false);
      }
    };

    bootstrap();

    return () => {
      alive = false;
    };
  }, [refreshUser, user]);

  if (isChecking) {
    return <Loader />;
  }

  if (!user) {
    return <Navigate to="/seller/auth" replace />;
  }

  const approved =
    user.approved !== false &&
    (!user.approvalStatus || user.approvalStatus === "approved");
  const onboardingSubmitted = user.onboardingSubmitted === true;
  const requiresOnboarding =
    !approved && (!onboardingSubmitted || user.approvalStatus === "draft");

  return (
    <Routes>
      <Route
        path="onboarding"
        element={
          approved ? <Navigate to="/seller" replace /> : <Onboarding />
        }
      />
      <Route
        path="pending"
        element={
          approved ? (
            <Navigate to="/seller" replace />
          ) : onboardingSubmitted ? (
            <PendingApproval />
          ) : (
            <Navigate to="/seller/onboarding" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          approved ? (
            <SellerWorkspace />
          ) : requiresOnboarding ? (
            <Navigate to="/seller/onboarding" replace />
          ) : (
            <Navigate to="/seller/pending" replace />
          )
        }
      />
    </Routes>
  );
};

const SellerRoutes = () => (
  <Suspense fallback={<Loader />}>
    <SellerAccessRouter />
  </Suspense>
);

export default SellerRoutes;
