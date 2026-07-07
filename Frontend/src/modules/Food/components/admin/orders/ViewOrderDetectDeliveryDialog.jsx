import { Clock, CheckCircle, XCircle, User, Phone, Package, MapPin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"

const getStatusColor = (status) => {
  const colors = {
    "Ordered": "bg-blue-100 text-blue-700 border-blue-200",
    "Restaurant Accepted": "bg-green-100 text-green-700 border-green-200",
    "Accepted": "bg-green-100 text-green-700 border-green-200", // Keep for backward compatibility
    "Rejected": "bg-red-100 text-red-700 border-red-200",
    "Delivery Boy Assigned": "bg-purple-100 text-purple-700 border-purple-200",
    "Delivery Boy Reached Pickup": "bg-orange-100 text-orange-700 border-orange-200",
    "Reached Pickup": "bg-orange-100 text-orange-700 border-orange-200", // Keep for backward compatibility
    "Order ID Accepted": "bg-indigo-100 text-indigo-700 border-indigo-200",
    "Reached Drop": "bg-amber-100 text-amber-700 border-amber-200",
    "Ordered Delivered": "bg-emerald-100 text-emerald-700 border-emerald-200",
  }
  return colors[status] || "bg-slate-100 text-slate-700 border-slate-200"
}

const getStatusIcon = (status) => {
  if (status === "Rejected") return XCircle
  if (status === "Ordered Delivered") return CheckCircle
  return Clock
}

export default function ViewOrderDetectDeliveryDialog({ isOpen, onOpenChange, order }) {
  if (!isOpen || !order) return null

  const StatusIcon = getStatusIcon(order.status)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-white p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-2xl font-bold text-slate-900">Order Details</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">Order ID: #{order.orderId}</DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* User Information */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                User Information
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="text-sm font-medium text-slate-900">{order.userName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone Number</p>
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {order.userNumber}
                  </p>
                </div>
                {order.originalOrder?.deliveryAddress && (
                  <div>
                    <p className="text-xs text-slate-500">Delivery Address</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {order.originalOrder.deliveryAddress.formattedAddress || 
                       [order.originalOrder.deliveryAddress.street, order.originalOrder.deliveryAddress.city, order.originalOrder.deliveryAddress.state, order.originalOrder.deliveryAddress.zipCode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {order.originalOrder?.address && !order.originalOrder?.deliveryAddress && (
                  <div>
                    <p className="text-xs text-slate-500">Delivery Address</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {order.originalOrder.address.formattedAddress || 
                       [order.originalOrder.address.street, order.originalOrder.address.city, order.originalOrder.address.state, order.originalOrder.address.zipCode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Restaurant Information */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Restaurant Information
              </h3>
              <div>
                <p className="text-xs text-slate-500">Restaurant Name</p>
                <p className="text-sm font-medium text-slate-900">{order.restaurantName}</p>
              </div>
            </div>

            {/* Delivery Boy Information */}
            {order.deliveryBoyName && (
              <div className="bg-slate-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Delivery Boy Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {order.deliveryBoyName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone Number</p>
                    <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {order.deliveryBoyNumber}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Status */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Current Status</h3>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${getStatusColor(order.status)}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="font-semibold">{order.status}</span>
            </div>
          </div>

          {/* Status History Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Status History</h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              
              {/* Status items */}
              <div className="space-y-4">
                {order.statusHistory && order.statusHistory.map((historyItem, index) => {
                  const HistoryIcon = getStatusIcon(historyItem.status)
                  
                  return (
                    <div key={index} className="relative flex items-start gap-4">
                      {/* Icon */}
                      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${getStatusColor(historyItem.status)}`}>
                        <HistoryIcon className="w-4 h-4" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${getStatusColor(historyItem.status).split(' ')[1]}`}>
                            {historyItem.status}
                          </span>
                          <span className="text-xs text-slate-500">{historyItem.timestamp}</span>
                        </div>
                        {historyItem.deliveryBoy && (
                          <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2">
                            <p><span className="font-medium">Delivery Boy:</span> {historyItem.deliveryBoy}</p>
                            {historyItem.deliveryBoyNumber && (
                              <p><span className="font-medium">Phone:</span> {historyItem.deliveryBoyNumber}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Bill Breakdown */}
          {(() => {
            const originalOrder = order.originalOrder || {}
            const items = originalOrder.items || originalOrder.cart?.items || originalOrder.cartItems || []
            const totalAmount = originalOrder.totalAmount ?? originalOrder.total ?? originalOrder.pricing?.total ?? originalOrder.pricing?.finalAmount
            if (items.length > 0) {
              return (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Bill Breakdown
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="space-y-3">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">{item.quantity || 1}x</span>
                            <span className="font-medium text-slate-900">{item.name || item.itemName || item.title || 'Unknown Item'}</span>
                          </div>
                          <span className="text-slate-700 font-medium">Rs. {((item.quantity || 1) * (item.price || item.itemPrice || 0)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {(totalAmount !== undefined && totalAmount !== null) && (
                      <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-semibold text-slate-900">Total Amount</span>
                        <span className="font-bold text-slate-900">Rs. {(typeof totalAmount === 'number' ? totalAmount : Number(totalAmount)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Order Date & Time */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-slate-500">Order Date</p>
                <p className="font-medium text-slate-900">{order.orderDate}</p>
              </div>
              <div>
                <p className="text-slate-500">Order Time</p>
                <p className="font-medium text-slate-900">{order.orderTime}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

