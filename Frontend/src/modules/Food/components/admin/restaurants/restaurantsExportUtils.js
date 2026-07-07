// Export utility functions for restaurants
export const exportRestaurantsToExcel = (restaurants, filename = "restaurants") => {
  const headers = [
    "SI",
    "Restaurant ID",
    "Restaurant Name",
    "Owner Name",
    "Owner Phone",
    "Zone",
    "Cuisine",
    "Status",
    "Rating"
  ]
  
  const rows = restaurants.map((restaurant, index) => [
    index + 1,
    restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id || "N/A",
    restaurant.name || "N/A",
    restaurant.ownerName || "N/A",
    restaurant.ownerPhone || "N/A",
    restaurant.zone || "N/A",
    restaurant.cuisine || "N/A",
    restaurant.status ? "Active" : "Inactive",
    restaurant.rating || 0
  ])
  
  const csvContent = [
    headers.join("\t"),
    ...rows.map(row => row.join("\t"))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportRestaurantsToPDF = (restaurants, filename = "restaurants") => {
  if (!restaurants || restaurants.length === 0) {
    alert("No data to export")
    return
  }

  try {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        })

        doc.setFontSize(16)
        doc.text('Restaurants List Report', 14, 15)
        
        doc.setFontSize(10)
        const exportDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        doc.text(`Exported on: ${exportDate} | Total Records: ${restaurants.length}`, 14, 22)

        const headers = [
          "SI",
          "Restaurant ID",
          "Restaurant Name",
          "Owner Name",
          "Owner Phone",
          "Zone",
          "Cuisine",
          "Status",
          "Rating"
        ]

        const tableData = restaurants.map((restaurant, index) => [
          index + 1,
          restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id || "N/A",
          restaurant.name || "N/A",
          restaurant.ownerName || "N/A",
          restaurant.ownerPhone || "N/A",
          restaurant.zone || "N/A",
          restaurant.cuisine || "N/A",
          restaurant.status ? "Active" : "Inactive",
          restaurant.rating || 0
        ])

        autoTable(doc, {
          startY: 30,
          head: [headers],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          styles: { fontSize: 9, cellPadding: 4 }
        })

        doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`)
      })
    })
  } catch (error) {
    console.error("PDF generation failed:", error)
    alert("Failed to generate PDF. Please try again.")
  }
}
