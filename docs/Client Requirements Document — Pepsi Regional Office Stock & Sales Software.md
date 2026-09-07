# Client Requirements Document
## Pepsi Regional Office Stock & Sales Software

### 1. Users & System Access

**Q1. How many people will use the software on a regular working day?**  
**Client Answer:** 2–3 users

**Q2. Which staff roles need access, and do they require restricted permissions?**  
**Client Answer:** Store Owner / General Manager  
**Access:** Full control and reports

---

### 2. Article & Item Information

**Q3. Approximately how many distinct products or items do you carry in stock?**  
**Client Answer:** 50–200 items  
**Note:** Standard distribution catalog

**Q4. Which product details must be tracked in the software for every item?**  
**Client Answer:**
- Item Name & Brand
- Wholesale Selling Price
- Retail Selling Price
- Low-Stock Minimum Alert Level  
  Example: alert when stock falls below 20 crates

Example items:
- Pepsi Regular
- 7Up Free

---

### 3. Stock Units & Measurement

**Q5. How do you purchase and sell your inventory units?**  
**Client Answer:** Full Crates / Cases only  
**Note:** Cases are never broken.

**Q6. Do you need automatic conversion between crates and loose bottles?**  
**Client Answer:** No

---

### 4. Receiving Goods (Stock In)

**Q7. How frequently do new shipments or replenishment orders arrive?**  
**Client Answer:** On-demand / as stock runs low

**Q8. What delivery information must be logged when receiving a shipment?**  
**Client Answer:** Quantity received  
- Total Crates
- Cartons
- Loose Bottles

---

### 5. Dispatch & Sales (Stock Out)

**Q9. What are your primary sales and dispatch channels?**  
**Client Answer:** Over-the-counter retail consumers  
**Note:** Individual cold bottles

**Q10. Do you sell goods on credit?**  
**Client Answer:** Yes

---

### 6. Damaged & Expired Goods

**Q11. How frequently does breakage, leakage, or product damage occur?**  
**Client Answer:** Frequent  
**Note:** Regular breakage during rough transit or loading

**Q12. Does the primary supplier replace or credit damaged goods?**  
**Client Answer:** No

---

### 7. Returns & Empty Containers

**Q13. Do customers or delivery vans ever return unsold or rejected goods?**  
**Client Answer:** Yes

**Return Handling:** Accepted returns are quarantined for inspection.

**Q14. How are returnable glass bottles and plastic storage crates handled?**  
**Client Answer:** Track crate debit/credit ledger balance per customer account

---

### 8. Pricing & Price Lists

**Q15. How are product selling prices and supplier purchase costs structured?**  
**Client Answer:** Multiple price tiers, including:
- Wholesale rate
- Retail rate
- Key accounts

**Supplier Purchase Cost:** Recorded manually for each delivery and used for profit calculation.

**Q16. Are promotional schemes offered?**  
**Client Answer:** No

---

### 9. Daily Operational Expenses

**Q17. Should the software record daily expenses paid directly from the cash register?**  
**Client Answer:** No

**Q18. Who is authorized to approve and pay petty cash expenses?**  
**Client Answer:** Both

---

### 10. Daily Audits & Stock Verification

**Q19. How frequently is a physical warehouse count performed?**  
**Client Answer:** Daily at closing time

**Note:** Key high-value, fast-moving items are counted.

**Q20. What is the procedure when physical warehouse stock does not match the system count?**  
**Client Answer:** 3 owner approval

---

### 11. Cash & Payment Balancing

**Q21. Which payment methods do customers use?**  
**Client Answer:**
- Physical Cash — Notes & Coins
- Mobile Money / QR Code Wallet
  - EasyPaisa
  - JazzCash
  - M-Pesa

**Q22. Is the cash drawer balanced at the close of every business day?**  
**Client Answer:** Yes

---

### 12. Profit & Margins Visibility

**Q23. Should the software calculate and show gross profit margins?**  
**Client Answer:** Yes

**Profit Calculation:** Latest Purchase Price

**Q24. Should cashiers and sales representatives be strictly prevented from seeing cost prices and profit margins?**  
**Client Answer:** Yes

---

### 13. Owner & Remote Management Access

**Q25. How does the business owner prefer to monitor operations while away from the office?**  
**Client Answer:** Daily summary message sent via WhatsApp or Email

**Q26. Are automatic instant alerts required for critical events?**  
**Client Answer:** Yes

**Selected Trigger:** Daily Closing Summary

---

### 14. Adjustments & Error Corrections

**Q27. Can a sales cashier cancel or modify an invoice once it has been printed / saved?**  
**Client Answer:** Yes

**Q28. How should incorrectly entered physical stock be adjusted?**  
**Client Answer:** Manager PIN approval is required before changing the stock count.

---

### 15. Required Reports & Exports

**Q29. Which reports and exports are required regularly?**  
**Client Answer:**
- Daily Sales & Revenue Summary
- Stock In / Receiving Report
- Stock Out / Dispatch Report
- Current Warehouse Stock on Hand with Total Value
- Low Stock Re-Order Alert Sheet
- Fast-Moving vs. Slow-Moving Item Analysis
- Price History
- Profit / Margin Report — Owner Only
- Customer Outstanding Balance & Aging Ledger
- Damaged / Expired Goods Write-off Log
- Daily Cash Collected vs. Paid Expenses
- Excel / CSV Spreadsheet Export for Accounting

---

### 16. Main Business Problem to Solve

**Q30. What is the single most frustrating stock or sales issue the software must solve?**

**Client Answer:**  
Daily sale profit margin, sales, and in-stock stock summary.

---

## Additional Information

**Additional Requirements:**  
Freeform notes for special hardware, operating hours, or custom rules.

**Client Code:**  
pepsiOffice

**Contact Person:**  
Optional

**Contact Phone:**  
Optional