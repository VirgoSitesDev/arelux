// File: src/lib/pdfTranslations.ts
// Traduzioni specifiche per il template PDF esistente

export const pdfTranslations = {
	it: {
	  // Meta
	  pdfTitle: 'Preventivo Arelux',
	  locale: 'it',
	  
	  // Header
	  date: 'Data',
	  client: 'Cliente',
	  quoteNumber: 'Preventivo #',
	  
	  // Titoli
	  areluxOffer: 'Offerta Arelux',
	  professionalLighting: 'SISTEMI DI ILLUMINAZIONE PROFESSIONALE',
	  
	  // Tabella
	  image: 'Immagine',
	  product: 'Prodotto',
	  price: 'Prezzo',
	  units: 'Unità',
	  totalPrice: 'Prezzo totale',
	  
	  // Descrizioni prodotto
	  professionalComponent: 'Componente per illuminazione professionale',
	  highEfficiency: 'Tecnologia LED ad alta efficienza',
	  premiumQuality: 'Materiali di prima qualità',
	  
	  // Totali
	  transportWithoutVAT: 'Trasporto senza IVA',
	  subtotalWithoutVAT: 'Subtotale senza IVA',
	  vat: 'IVA',
	  totalWithVAT: 'Totale con IVA',
	  
	  // Footer
	  offerValidity: 'L\'offerta è valida per 30 giorni.',
	  copyright: '© Copyright 2024 Arelux SRL',
	  
	  // Valuta
	  currency: '€'
	},
	
	en: {
	  // Meta
	  pdfTitle: 'Arelux Quote',
	  locale: 'en',
	  
	  // Header
	  date: 'Date',
	  client: 'Client',
	  quoteNumber: 'Quote #',
	  
	  // Titles
	  areluxOffer: 'Arelux offer',
	  professionalLighting: 'PROFESSIONAL LIGHTING SYSTEMS',
	  
	  // Table
	  image: 'Image',
	  product: 'Product',
	  price: 'Price',
	  units: 'Units',
	  totalPrice: 'Total price',
	  
	  // Product descriptions
	  professionalComponent: 'Professional lighting component',
	  highEfficiency: 'High efficiency LED technology',
	  premiumQuality: 'Premium quality materials',
	  
	  // Totals
	  transportWithoutVAT: 'Transport without VAT',
	  subtotalWithoutVAT: 'Subtotal without VAT',
	  vat: 'VAT',
	  totalWithVAT: 'Total with VAT',
	  
	  // Footer
	  offerValidity: 'The offer is valid for 30 days.',
	  copyright: '© Copyright 2024 Arelux SRL',
	  
	  // Currency
	  currency: '€'
	}
  };
  
  export function getPdfTranslations(locale: string): typeof pdfTranslations.it {
	return pdfTranslations[locale as keyof typeof pdfTranslations] || pdfTranslations.it;
  }