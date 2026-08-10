// Facture - Template Typst pour Échoppe
// Données passées via fichier JSON

#let data = json(sys.inputs.data)

#let seller = data.seller
#let buyer = data.buyer
#let invoice = data.invoice
#let items = data.items

// Formatage monétaire
#let money(amount) = {
  let num = float(amount)
  let formatted = str(calc.round(num, digits: 2))
  if not formatted.contains(".") { formatted += ".00" }
  let parts = formatted.split(".")
  if parts.at(1).len() == 1 { formatted += "0" }
  formatted.replace(".", ",") + " €"
}

// Formatage date
#let format-date(date-str) = {
  if date-str == none { return "" }
  let parts = date-str.split("T").at(0).split("-")
  parts.at(2) + "/" + parts.at(1) + "/" + parts.at(0)
}

// Configuration page
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 2cm, right: 2cm),
  footer: context [
    #set text(size: 8pt, fill: luma(100))
    #line(length: 100%, stroke: 0.5pt + luma(200))
    #v(0.3cm)
    #seller.legalName #if seller.legalForm != none [ — #seller.legalForm] #if seller.shareCapital != none [ au capital de #money(seller.shareCapital)]
    #linebreak()
    #if seller.siret != none [SIRET : #seller.siret] #if seller.tvaIntra != none [ — TVA : #seller.tvaIntra] #if seller.rcsCity != none [ — RCS #seller.rcsCity]
    #h(1fr)
    #counter(page).display("1/1", both: true)
  ]
)

#set text(font: "Arial", size: 10pt, fill: luma(30))
#set par(leading: 0.6em)

// En-tête
#grid(
  columns: (1fr, 1fr),
  gutter: 2cm,
  [
    // Logo ou nom boutique
    #if data.logoPath != none [
      #image(data.logoPath, width: 4cm)
    ] else [
      #text(size: 20pt, weight: "bold", fill: luma(40))[#seller.shopName]
    ]
    #v(0.3cm)
    #text(size: 9pt, fill: luma(80))[
      #seller.street
      #if seller.street2 != none [#linebreak()#seller.street2]
      #linebreak()
      #seller.postalCode #seller.city
      #linebreak()
      #seller.publicEmail
      #if seller.publicPhone != none [#linebreak()#seller.publicPhone]
    ]
  ],
  [
    #align(right)[
      #text(size: 24pt, weight: "bold", fill: rgb("#2563eb"))[
        #if invoice.type == "credit_note" [AVOIR] else [FACTURE]
      ]
      #v(0.2cm)
      #text(size: 14pt, weight: "semibold")[#invoice.number]
      #v(0.5cm)
      #text(size: 9pt, fill: luma(80))[
        Date d'émission : #format-date(invoice.dateIssued)
        #if invoice.dateDue != none [
          #linebreak()
          Date d'échéance : #format-date(invoice.dateDue)
        ]
        #linebreak()
        Commande : #invoice.orderNumber
      ]
    ]
  ]
)

#v(1.5cm)

// Destinataire
#box(
  width: 50%,
  inset: (left: 0pt),
  [
    #text(size: 8pt, weight: "semibold", fill: luma(100))[FACTURÉ À]
    #v(0.2cm)
    #text(weight: "semibold")[
      #if buyer.company != none [#buyer.company #linebreak()]
      #buyer.firstName #buyer.lastName
    ]
    #v(0.1cm)
    #text(size: 9pt, fill: luma(60))[
      #buyer.street
      #if buyer.street2 != none [#linebreak()#buyer.street2]
      #linebreak()
      #buyer.postalCode #buyer.city
      #if buyer.country != none [#linebreak()#buyer.country]
      #if buyer.email != none [#linebreak()#buyer.email]
    ]
  ]
)

#v(1cm)

// Tableau des lignes
#table(
  columns: (1fr, auto, auto, auto, auto),
  align: (left, center, right, center, right),
  stroke: none,
  inset: (x: 8pt, y: 10pt),

  // Header
  table.header(
    table.cell(fill: luma(245))[#text(weight: "semibold", size: 9pt)[Désignation]],
    table.cell(fill: luma(245))[#text(weight: "semibold", size: 9pt)[Qté]],
    table.cell(fill: luma(245))[#text(weight: "semibold", size: 9pt)[Prix unit. HT]],
    table.cell(fill: luma(245))[#text(weight: "semibold", size: 9pt)[TVA]],
    table.cell(fill: luma(245))[#text(weight: "semibold", size: 9pt)[Total HT]],
  ),

  table.hline(stroke: 0.5pt + luma(200)),

  // Lignes
  ..items.map(item => (
    item.label,
    str(item.quantity),
    money(item.unitPriceHt),
    if invoice.taxExemptMention != none [—] else [#str(calc.round(float(item.taxRate), digits: 1))#sym.space.thin%],
    money(item.totalHt),
  )).flatten(),
)

#v(0.5cm)

// Totaux
#align(right)[
  #box(width: 45%)[
    #table(
      columns: (1fr, auto),
      align: (left, right),
      stroke: none,
      inset: (x: 8pt, y: 6pt),

      [Total HT], [#money(invoice.totalHt)],

      ..if invoice.taxExemptMention != none {
        (table.cell(colspan: 2)[
          #text(size: 9pt, style: "italic", fill: luma(80))[#invoice.taxExemptMention]
        ],)
      } else {
        ([TVA], [#money(invoice.totalTax)])
      },

      table.hline(stroke: 1pt + luma(180)),

      table.cell(fill: luma(245))[#text(weight: "bold")[Total TTC]],
      table.cell(fill: luma(245))[#text(weight: "bold", size: 12pt)[#money(invoice.totalTtc)]],
    )
  ]
]

#v(1cm)

// Conditions de paiement
#box(
  width: 100%,
  fill: luma(250),
  inset: 12pt,
  radius: 4pt,
  [
    #text(size: 9pt, weight: "semibold")[Conditions de règlement]
    #v(0.2cm)
    #text(size: 8pt, fill: luma(60))[
      Paiement à réception de facture, sauf accord préalable.
      #linebreak()
      En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera exigible (art. L.441-6 C. com.).
      #linebreak()
      Une indemnité forfaitaire de 40 € pour frais de recouvrement sera également due (art. D.441-5 C. com.).
    ]
  ]
)
