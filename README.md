# FleetProfit Ledger

Build a complete production-ready full-stack web application named:



"Eicher Calculation"



This is a vehicle-wise trip accounting and profit calculation system.



IMPORTANT:

- Build BOTH frontend and backend.

- Frontend and backend must be properly connected.

- Use MongoDB as the permanent database.

- Do NOT use PostgreSQL.

- Do NOT make this a localStorage-only application.

- The application will be used mostly from an Android mobile phone, so mobile-first responsive design is extremely important.

- Do NOT publish/deploy the application yet. I want to test the preview first.

- Make the UI extremely premium, modern and professional.



==================================================

1. TECHNOLOGY STACK

==================================================



Frontend:

- React

- TypeScript

- Tailwind CSS

- shadcn/ui

- React Router

- Responsive mobile-first design



Backend:

- Node.js

- Express.js

- TypeScript

- REST API

- MongoDB

- Mongoose



Database:

- MongoDB

- Use environment variable:

  MONGODB_URI



Keep secrets in environment variables.

Never hardcode MongoDB credentials.



Suggested structure:



/client or /src

/server

/models

/routes

/controllers

/services

/config

/utils



The exact structure can be adapted if needed, but keep frontend and backend clearly separated and maintainable.



==================================================

2. APPLICATION NAME

==================================================



Default application name:



Eicher Calculation



The application name must be editable from Settings.



Example:



Application Name:

[Eicher Calculation]



[Save]



When changed:

- Update navbar/header

- Update dashboard title

- Update reports

- Update generated PDFs

- Save permanently in MongoDB



If the user changes it to:

"Patel Transport"



then the entire application should display "Patel Transport".



==================================================

3. MULTIPLE VEHICLES

==================================================



IMPORTANT:

The application must NOT be limited to trucks or Eicher vehicles.



The user must be able to add ANY type of vehicle.



Examples:

- Eicher Pro 2114

- Truck

- Tractor

- Eicher

- Pickup

- Bolero

- Tempo

- Bus

- Other



Default vehicle:



Vehicle Name:

Eicher Pro 2114



Vehicle Model:

Eicher Pro 2114 24 Ft



Vehicle Type:

Truck



Vehicle Number:

Allow user to enter it.



Only create this default vehicle when the MongoDB database has no vehicles.



==================================================

4. VEHICLE CRUD

==================================================



Create a proper vehicle management system.



Features:



[+ Add Vehicle]



Vehicle form:



- Vehicle Name

- Vehicle Type

- Vehicle Model

- Vehicle Number

- Optional Notes



Buttons:



Save Vehicle

Cancel



Each vehicle can be:



- Added

- Edited

- Deleted

- Selected



Before deleting a vehicle, show confirmation.



Example:



"Are you sure you want to delete this vehicle?

All trips belonging to this vehicle may also be deleted."



Do not accidentally delete data.



==================================================

5. VEHICLE-WISE DATA ISOLATION

==================================================



THIS IS EXTREMELY IMPORTANT.



Every trip belongs to exactly ONE vehicle.



When I select:



Eicher Pro 2114



the dashboard must show ONLY:



- Eicher Pro 2114 income

- Eicher Pro 2114 diesel

- Eicher Pro 2114 driver expense

- Eicher Pro 2114 other expense

- Eicher Pro 2114 EMI

- Eicher Pro 2114 total expense

- Eicher Pro 2114 profit

- Eicher Pro 2114 trips



If I switch to another vehicle:



Bolero



then EVERYTHING must immediately switch to Bolero's data.



Never mix data between vehicles.



Vehicle selection must affect:



- Dashboard

- Trip list

- Add trip

- Edit trip

- Delete trip

- Reports

- PDF

- Monthly totals

- Profit calculations

- Charts/statistics



Add a prominent vehicle selector at the top.



Example:



VEHICLE

[ Eicher Pro 2114 ▼ ]



==================================================

6. DAILY TRIP ENTRY

==================================================



Create a professional Add Trip screen.



Fields:



Date

Vehicle

Income

Diesel

Driver Payment

Other Expenses

EMI Share



Optional:

Notes



The selected vehicle should automatically be selected.



Example:



Date:

[31/08/2026]



Income:

[₹14,500]



Diesel:

[₹6,000]



Driver Payment:

[₹1,000]



Other Expenses:

[₹1,500]



EMI Share:

[₹1,700]



Automatically calculate:



Total Expense =

Diesel + Driver Payment + Other Expenses + EMI Share



Profit =

Income - Total Expense



Example:



Income = ₹14,500

Diesel = ₹6,000

Driver = ₹1,000

Other = ₹1,500

EMI = ₹1,700



Total Expense = ₹10,200



Profit = ₹4,300



Do NOT require the user to manually calculate these values.



==================================================

7. DRIVER EXPENSE MUST BE EDITABLE

==================================================



Driver payment is NOT always fixed.



The user must be able to change it for every trip.



Example:



Day 1:

Driver = ₹1,000



Day 2:

Driver = ₹1,500



Day 3:

Driver = ₹800



Each trip stores its own driver payment.



Do NOT use one global fixed driver amount.



==================================================

8. MONEY INPUT UI

==================================================



This is very important for Android mobile.



If user types:



14500



display:



₹14,500



If user types:



6000



display:



₹6,000



If user types:



125000



display:



₹1,25,000



Use Indian number formatting.



The input must NOT:

- hide the first digit

- overlap the ₹ symbol

- clip digits

- jump/cut text

- break on Android Chrome



The entire amount must remain visible.



Use proper input padding and layout.



Currency values must remain numeric internally for calculations.



==================================================

9. TRIP MANAGEMENT

==================================================



Create a Trips page.



Show trips in a mobile-friendly list/table.



Columns/details:



Date

Vehicle

Income

Diesel

Driver

Other

EMI

Total Expense

Profit



On mobile, use cards if a table becomes too wide.



Actions:



Edit

Delete



Delete requires confirmation.



Editing must update MongoDB.



==================================================

10. DASHBOARD

==================================================



Create a premium dashboard.



At top:



Application Name



Vehicle selector



Selected vehicle:



Eicher Pro 2114 24 Ft



Dashboard cards:



Total Trips

Total Income

Total Expense

Total Profit



Also show:



Diesel Total

Driver Total

Other Expense Total

EMI Total



All dashboard numbers must be calculated from the selected vehicle only.



Add a clean visual summary.



Possible chart:



Income vs Expense vs Profit



Keep charts responsive and readable on mobile.



==================================================

11. DATE FILTER

==================================================



Dashboard should allow date filtering.



Options:



Today

This Week

This Month

Last Month

Custom



Custom:



From Date

To Date



All totals should update according to selected date range.



==================================================

12. REPORT SYSTEM

==================================================



Create a dedicated:



REPORTS



page.



When the user clicks Report, show:



Report Period



[1 Month]

[3 Months]

[6 Months]

[12 Months]

[Custom Date Range]



If Custom is selected:



From Date

To Date



The user can select any date range.



The report must show ONLY records belonging to:



1. selected vehicle

2. selected date range



Never mix vehicles.



==================================================

13. REPORT PREVIEW

==================================================



Before downloading PDF, show a preview.



Display:



Selected Vehicle

From Date

To Date



Total Trips

Total Income

Total Diesel

Total Driver Payment

Total Other Expenses

Total EMI

Total Expense

Net Profit



Then daily records:



Date

Vehicle

Income

Diesel

Driver

Other

EMI

Total Expense

Profit



Make the preview mobile-friendly.



==================================================

14. REPORT PERIOD LOGIC

==================================================



1 Month:

Show selected month's data.



3 Months:

Show the last/selected 3-month period.



6 Months:

Show 6 months.



12 Months:

Show 12 months.



Custom:

Use exact From Date and To Date entered by the user.



Make date filtering accurate.



Avoid timezone-related date bugs.



==================================================

15. PDF DOWNLOAD

==================================================



Add:



[Download PDF]



The PDF must contain:



Application Name



Selected Vehicle



Report Period



From Date

To Date



Summary:



Total Trips

Total Income

Total Diesel

Total Driver

Total Other Expense

Total EMI

Total Expense

Net Profit



Daily table:



Date

Vehicle

Income

Diesel

Driver

Other Expense

EMI

Total Expense

Profit



At bottom:



TOTAL



The PDF must contain ONLY the filtered records.



If the selected vehicle is Eicher Pro 2114,

do not include Bolero data.



Use production-quality PDF generation.



PDF should look professional.



==================================================

16. SETTINGS

==================================================



Create Settings page.



Settings:



Application Name

Currency

Default Vehicle



Application Name must be editable.



Save settings to MongoDB.



Do not store only in localStorage.



==================================================

17. DATABASE MODELS

==================================================



Use MongoDB with Mongoose.



Vehicle model:



{

  _id,

  name,

  type,

  model,

  vehicleNumber,

  notes,

  createdAt,

  updatedAt

}



Trip model:



{

  _id,

  vehicleId,

  date,

  income,

  diesel,

  driverPayment,

  otherExpenses,

  emiShare,

  notes,

  createdAt,

  updatedAt

}



Settings model:



{

  _id,

  appName,

  currency,

  defaultVehicleId,

  updatedAt

}



Use proper MongoDB ObjectId references.



Add indexes where useful, especially:



vehicleId

date



==================================================

18. BACKEND API

==================================================



Create REST APIs.



Vehicles:



GET    /api/vehicles

GET    /api/vehicles/:id

POST   /api/vehicles

PUT    /api/vehicles/:id

DELETE /api/vehicles/:id



Trips:



GET    /api/trips

GET    /api/trips/:id

GET    /api/vehicles/:vehicleId/trips

POST   /api/trips

PUT    /api/trips/:id

DELETE /api/trips/:id



Reports:



GET /api/reports



Support:



vehicleId

fromDate

toDate



Settings:



GET /api/settings

PUT /api/settings



Health:



GET /api/health



Return proper HTTP status codes and JSON responses.



==================================================

19. VALIDATION

==================================================



Validate:



Income >= 0

Diesel >= 0

Driver Payment >= 0

Other Expenses >= 0

EMI >= 0



Date is required.



Vehicle is required.



Vehicle number should be trimmed.



Do not allow invalid negative values.



Show friendly validation messages.



==================================================

20. CALCULATION RULES

==================================================



Total Expense:



diesel

+ driverPayment

+ otherExpenses

+ emiShare



Profit:



income - totalExpense



Do not allow frontend and backend calculations to become inconsistent.



Backend should also calculate/validate totals where appropriate.



Never trust only frontend calculations.



==================================================

21. LUXURY UI

==================================================



The UI must look PREMIUM.



Design direction:



Luxury transport / fleet management SaaS.



Use:



- Dark graphite background

- Black/charcoal surfaces

- Subtle gold accents

- Elegant white typography

- Soft shadows

- Glassmorphism where appropriate

- Rounded cards

- Premium spacing

- Smooth hover/tap effects

- Professional icons

- Clean typography



Do NOT make it look like a basic student project.



It should look like a commercial fleet accounting application.



==================================================

22. MOBILE-FIRST DESIGN

==================================================



Most usage will be from Android mobile.



Optimize especially for:



Android Chrome

Samsung phones

Small screens

Touch input



Requirements:



- No horizontal scrolling

- Buttons minimum comfortable touch size

- Inputs easy to tap

- Bottom navigation or compact navigation

- Sticky important actions where useful

- Cards instead of huge desktop tables

- Responsive dialogs

- Responsive PDF/report controls



Test at approximately:



360px

390px

412px

768px

1024px+



==================================================

23. NAVIGATION

==================================================



Recommended navigation:



Dashboard

Vehicles

Trips

Reports

Settings



On mobile:



Use bottom navigation or another clean mobile navigation.



Add a floating or prominent:



+ Add Trip



button where appropriate.



==================================================

24. EMPTY STATES

==================================================



If no vehicle:



"No vehicles found"



[+ Add Vehicle]



If no trips:



"No trips found for this vehicle."



[+ Add Trip]



If report has no data:



"No data found for the selected vehicle and date range."



==================================================

25. ERROR HANDLING

==================================================



Handle:



MongoDB connection errors

API errors

Network errors

Invalid data

404

500



Show user-friendly messages.



Do not expose database credentials.



Add loading states.



Add skeleton loaders where appropriate.



==================================================

26. DATA PERSISTENCE

==================================================



IMPORTANT:



All vehicles, trips and settings must survive:



- browser refresh

- closing browser

- reopening application

- different device/browser when connected to same backend



Use MongoDB as the source of truth.



Do NOT depend on localStorage for permanent application data.



==================================================

27. DEFAULT DATA

==================================================



On first database initialization only:



If there are no vehicles:



Create:



Name:

Eicher Pro 2114



Model:

Eicher Pro 2114 24 Ft



Type:

Truck



Do not recreate it every time the server starts.



==================================================

28. SECURITY

==================================================



Use:



.env



Example:



MONGODB_URI=your_mongodb_connection_string



Never expose MongoDB URI to frontend.



Use backend-only database access.



Configure CORS properly.



Validate request bodies.



Sanitize inputs.



==================================================

29. PERFORMANCE

==================================================



Use efficient MongoDB queries.



For vehicle-wise data:



Always query using vehicleId.



For reports:



Filter by:



vehicleId

date range



Do not load unnecessary records.



Use pagination for large trip lists if needed.



==================================================

30. RESPONSIVE PDF

==================================================



PDF generation should handle:



Small amount of data

Large amount of data

Multiple pages



Repeat table headers on every page.



Use Indian currency formatting.



Example:



₹14,500

₹6,000

₹1,500

₹1,700

₹4,300



==================================================

31. TESTING

==================================================



Before considering the project complete, test:



1. Add vehicle

2. Edit vehicle

3. Delete vehicle

4. Switch vehicle

5. Add trip

6. Edit trip

7. Delete trip

8. Driver amount changes per trip

9. Automatic expense calculation

10. Automatic profit calculation

11. Vehicle-wise dashboard

12. Vehicle-wise trip list

13. Vehicle-wise report

14. 1 month report

15. 3 month report

16. 6 month report

17. 12 month report

18. Custom date report

19. PDF download

20. PDF date filtering

21. PDF vehicle filtering

22. Settings save

23. App name changes

24. Refresh browser and verify data persists

25. Android mobile layout

26. Currency input ₹14,500 display

27. MongoDB persistence

28. API error handling



Fix all discovered errors before presenting the preview.



==================================================

32. VERY IMPORTANT BUSINESS RULE

==================================================



This application is primarily a VEHICLE-WISE ACCOUNTING SYSTEM.



The selected vehicle is the main context.



Example:



Vehicle A:

Income = ₹14,500

Expense = ₹10,200

Profit = ₹4,300



Vehicle B:

Income = ₹20,000

Expense = ₹12,000

Profit = ₹8,000



When Vehicle A is selected:



ONLY Vehicle A values appear.



When Vehicle B is selected:



ONLY Vehicle B values appear.



Never combine them unless the user explicitly requests an "All Vehicles" report.



==================================================

33. OPTIONAL ALL VEHICLES VIEW

==================================================



Add an optional:



All Vehicles



selection.



If selected:



Show combined totals for all vehicles.



But default behavior must be a specific vehicle.



Reports should clearly show:



Vehicle: All Vehicles



when applicable.



==================================================

34. FINAL QUALITY

==================================================



Do not build a simple demo.



Build a complete production-ready application.



Use clean reusable components.



Use proper TypeScript types.



Avoid duplicated code.



Keep frontend/backend architecture clean.



Make the application visually impressive.



Most importantly:



FUNCTIONALITY > DECORATION



All calculations must be accurate.

All vehicle data must remain separated.

All data must persist in MongoDB.

Reports must filter correctly.

PDFs must contain exactly the selected data.

Mobile UI must work perfectly.



==================================================

35. DEPLOYMENT RULE

==================================================



DO NOT DEPLOY OR PUBLISH YET.



First complete the application and make the preview fully functional.



After implementation, provide the preview for testing.



Wait for my confirmation/approval.



Only after I say "OK" or "Live karo":



Then prepare production deployment.



==================================================



FINAL INSTRUCTION:



Start building the complete Eicher Calculation application now.



Build frontend + Node.js/Express backend + MongoDB integration + luxury responsive UI + vehicle-wise accounting + reports + PDF + settings.



Do not stop at a UI mockup.



Everything must be connected and functional.

Improve the "Other Expenses" section.



Instead of only entering one total amount, allow the user to add multiple Other Expense items for each trip.



For each item provide:

- Expense Name / Description

- Amount



Example:

Toll              ₹500

Parking           ₹100

Food              ₹300

Loading/Unloading ₹600



Automatically calculate:

Total Other Expenses = sum of all Other Expense items



Show the total in the trip calculation.



Allow:

+ Add Other Expense

Edit expense

Delete expense



The user can add as many expense items as needed for a trip.



Store every expense item permanently in MongoDB and associate it with the correct trip and vehicle.



When generating reports and PDFs:

- Show each Other Expense item clearly

- Show the total Other Expenses

- Include the total in Total Expense

- Calculate Profit correctly



Do not break the existing vehicle-wise data separation.



Keep the UI premium, clean and fully mobile responsive.

Update the Reports page to show the report data in a proper professional TABLE FORMAT.



Columns:

Date | Vehicle | Income | Diesel | Driver | Other Expense | EMI | Total Expense | Profit



Requirements:

- Show one trip per table row.

- Show all selected vehicle's trips according to the selected date range.

- Keep the selected vehicle and date range clearly visible above the table.

- Add a TOTAL row at the bottom.

- Total row must calculate:

  Total Income

  Total Diesel

  Total Driver

  Total Other Expense

  Total EMI

  Total Expense

  Total Profit

- Use Indian currency formatting such as ₹14,500 and ₹6,000.

- If there are many rows, allow vertical scrolling.

- On mobile, make the table horizontally scrollable without breaking the page layout.

- Keep the table clean, readable and premium.

- Use sticky table header when scrolling if possible.

- Do not mix data from different vehicles.

- The exact same filtered table data must be used when generating the PDF.

- Keep the luxury dark graphite + subtle gold UI.

- Make the table fully responsive for Android Chrome.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8efa1e3e-cdab-42f1-95b8-af742493cc54).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
