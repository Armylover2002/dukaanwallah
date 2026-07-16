export const quickAdminSidebarMenu = [
  {
    type: "link",
    label: "Dashboard",
    permissionKey: "dashboard",
    path: "/admin/quick-commerce",
    icon: "LayoutDashboard",
  },
  {
    type: "section",
    label: "CORE MANAGEMENT",
    permissionKey: "core_management",
    items: [

      {
        type: "expandable",
        label: "Categories",
        permissionKey: "categories",
        icon: "FolderTree",
        subItems: [
          { label: "All Categories", path: "/admin/quick-commerce/categories/hierarchy", permissionKey: "hierarchy" },
          { label: "Header Categories", path: "/admin/quick-commerce/categories/header", permissionKey: "header" },
          { label: "Main Categories", path: "/admin/quick-commerce/categories/level2", permissionKey: "main" },
          { label: "Sub-Categories", path: "/admin/quick-commerce/categories/sub", permissionKey: "sub" },
        ],
      },
      { type: "link", label: "Products", permissionKey: "products", path: "/admin/quick-commerce/products", icon: "Package" },
      { type: "link", label: "Zone Setup", permissionKey: "zone_setup", path: "/admin/quick-commerce/zone-setup", icon: "MapPin" },
      { type: "link", label: "Quick Zone Hub", permissionKey: "zone_setup", path: "/admin/quick-commerce/quick-zone-hubs", icon: "MapPin" },
      {
        type: "expandable",
        label: "Marketing Tools",
        permissionKey: "marketing_tools",
        icon: "Megaphone",
        subItems: [
          { label: "Content Manager", path: "/admin/quick-commerce/experience-studio", permissionKey: "experience_studio" },
          { label: "Hero & Categories Per Page", path: "/admin/quick-commerce/hero-categories", permissionKey: "hero_categories" },
          { label: "Seller Coupon Request", path: "/admin/quick-commerce/seller-coupon-request", permissionKey: "seller_coupon_request" },
          { label: "Coupons & Promos", path: "/admin/quick-commerce/coupons", permissionKey: "coupons" },
          { label: "Offer Sections", path: "/admin/quick-commerce/offer-sections", permissionKey: "offer_sections" },
          // { label: "Shop by Store", path: "/admin/quick-commerce/shop-by-store", permissionKey: "shop_by_store" },
        ],
      },
      // {
      //   type: "expandable",
      //   label: "Customer Support",
      //   permissionKey: "customer_support",
      //   icon: "MessageSquare",
      //   subItems: [
      //     { label: "Help Tickets", path: "/admin/quick-commerce/support-tickets", permissionKey: "tickets" },
      //     { label: "Review Content", path: "/admin/quick-commerce/moderation", permissionKey: "moderation" },
      //   ],
      // },
      {
        type: "expandable",
        label: "Sellers",
        permissionKey: "sellers",
        icon: "Building2",
        subItems: [
          { label: "Active Sellers", path: "/admin/quick-commerce/sellers/active", permissionKey: "active" },
          { label: "Seller Requests", path: "/admin/quick-commerce/sellers/pending", permissionKey: "pending" },
          // { label: "Seller Locations", path: "/admin/quick-commerce/seller-locations", permissionKey: "locations" },
          { label: "Seller Commission", path: "/admin/quick-commerce/sellers/commission", permissionKey: "commission" },
          { label: "COD Deposit Verification", path: "/admin/quick-commerce/sellers/cod-deposit-verification", permissionKey: "commission" },
        ],
      },

      {
        type: "expandable",
        label: "Transaction Management",
        permissionKey: "wallet",
        icon: "Receipt",
        subItems: [
          { label: "Seller Transactions", path: "/admin/quick-commerce/seller-order-transactions", permissionKey: "wallet" },
          { label: "Money Requests", path: "/admin/quick-commerce/withdrawals", permissionKey: "withdrawals" },
          { label: "Seller Payments", path: "/admin/quick-commerce/seller-transactions", permissionKey: "seller_payments" },
          { label: "Seller Penalty", path: "/admin/quick-commerce/seller-penalty", permissionKey: "seller_penalty" }
        ]
      },
      // { type: "link", label: "Customers", permissionKey: "customers", path: "/admin/quick-commerce/customers", icon: "Users" },
      // { type: "link", label: "FAQs", permissionKey: "faqs", path: "/admin/quick-commerce/faqs", icon: "MessageSquare" },
      { type: "link", label: "Return Orders", permissionKey: "return_orders", path: "/admin/quick-commerce/return-orders", icon: "RotateCcw" },
      {
        type: "expandable",
        label: "Orders",
        permissionKey: "orders",
        icon: "FileText",
        subItems: [
          { label: "All Orders", path: "/admin/quick-commerce/orders/all", permissionKey: "all" },
          { label: "New Orders", path: "/admin/quick-commerce/orders/pending", permissionKey: "pending" },
          { label: "Being Prepared", path: "/admin/quick-commerce/orders/processed", permissionKey: "processed" },
          { label: "On the Way", path: "/admin/quick-commerce/orders/out-for-delivery", permissionKey: "out_for_delivery" },
          { label: "Delivered", path: "/admin/quick-commerce/orders/delivered", permissionKey: "delivered" },
          { label: "Cancelled", path: "/admin/quick-commerce/orders/cancelled", permissionKey: "cancelled" },
          { label: "Returned", path: "/admin/quick-commerce/orders/returned", permissionKey: "returned" },
        ],
      },
      { type: "link", label: "Fees & Charges", permissionKey: "billing", path: "/admin/quick-commerce/billing", icon: "IndianRupee " },
      { type: "link", label: "My Profile", permissionKey: "profile", path: "/admin/quick-commerce/profile", icon: "User" },
    ],
  },
]
