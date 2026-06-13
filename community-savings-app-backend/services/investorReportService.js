const PDFDocument = require('pdfkit')
const fs = require('fs')

const generateReport = (data, filename = "report.pdf") => {
  const doc = new PDFDocument()

  doc.pipe(fs.createWriteStream(filename))

  doc.fontSize(18).text("TITech Investor Report")
  doc.moveDown()

  doc.text(`Total Loans: ${data.totalLoans}`)
  doc.text(`Defaults: ${data.defaults}`)
  doc.text(`Active: ${data.activeLoans}`)

  doc.end()
}

module.exports = { generateReport }