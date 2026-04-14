# 👟 Single Shoe Match System

A web-based system designed to help retail stores match single shoes across a shared network and recover lost inventory value.

---

## 🚀 Overview

In retail environments, single shoes often become unsellable due to missing pairs, leading to lost revenue.

This system solves that problem by:

* Connecting multiple stores into a shared network
* Automatically identifying potential matches
* Allowing stores to request and confirm pairings
* Tracking recovered inventory value

---

## 🔧 Features

* 🏢 **Network System**

  * Create or join store networks using a join code
  * Multi-store collaboration

* 👟 **Add Single Shoes**

  * Upload shoe details and images
  * Store-specific submissions

* 🔍 **Automatic Match Detection**

  * Matches based on brand, model, size, gender, and color
  * Prevents mismatched pairs

* 🔁 **Match Requests Workflow**

  * Send requests to other stores
  * Approve or reject matches
  * Track pending confirmations

* 💰 **Recovered Value Tracking**

  * Track confirmed pairs
  * Calculate recovered inventory value
  * Store-level and network-level stats

* 📊 **Dashboard**

  * Network overview (pairs made, total value, total singles)
  * Store-specific stats (singles, matches, recovered value)
  * Clean and interactive UI

---

## 🧠 Purpose

This project was built to solve a real-world retail problem by improving collaboration between stores and reducing inventory loss.

---

## 🛠 Tech Stack

* **Backend:** Node.js, Express
* **Database:** SQLite
* **Frontend:** HTML, CSS
* **File Uploads:** Multer
* **Session Management:** express-session

---

## ⚙️ How to Run Locally

1. Clone the repository:

```bash
git clone https://github.com/Usohail1-source/single-shoe-match-system.git
cd single-shoe-match-system
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
node server.js
```

4. Open in browser:

```
http://localhost:3000
```

---

## 📌 Future Improvements

* 📷 Barcode/UPC scanning for auto-fill
* 🔔 Real-time match notifications
* 📱 Mobile-friendly UI improvements
* 📊 Advanced analytics for store performance
* 🔐 Authentication & user roles

---

## 💡 Author

**Umar Sohail**
GitHub: https://github.com/Usohail1-source

---

## 📄 License

This project is for educational and demonstration purposes.
