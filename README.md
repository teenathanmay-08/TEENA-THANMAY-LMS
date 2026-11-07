# TEENA THANMAY – Online Course Learning Management System

A responsive purple-and-white Learning Management System built with Node.js, Express, EJS, MySQL, HTML, CSS and JavaScript.

## Features

- Four MySQL tables: `users`, `courses`, `lessons`, `enrollments`
- Student registration and login
- Admin, instructor and student roles
- Admin dashboard with counts and paid-fee total
- Create and manage users
- Add and edit courses with instructor, description, price and image
- Add lessons and upload PDF, DOC/DOCX, PPT/PPTX, TXT, MP4/WEBM and image materials (15 MB maximum)
- Student course enrollment
- Enrollment fee and payment status management
- Student course progress tracking
- Course search and responsive design
- Purple + white visual theme and learning photos

## Requirements

- Node.js (LTS recommended)
- MySQL Server 8.0
- MySQL Workbench (for running SQL)
- VS Code

## Setup

1. Extract the ZIP.
2. Open the `TEENA_THANMAY_LMS` folder in VS Code.
3. In MySQL Workbench, run `database.sql` to create the database and four tables. If you already created the same four tables, this script uses `IF NOT EXISTS` and will not delete existing records.
4. Copy `.env.example` and rename the copy to `.env`.
5. Open `.env` and enter your MySQL root password in `DB_PASSWORD`. Keep `DB_NAME=teena_thanmay_lms`.
6. Open the VS Code terminal in the project folder and run:

   ```bash
   npm install
   ```

7. Add the sample accounts and sample course data:

   ```bash
   npm run seed
   ```

8. Start the website:

   ```bash
   npm start
   ```

9. Open `http://localhost:3000` in your browser.

## Demo accounts

The seed script creates these accounts only if their email addresses do not already exist:

| Role | Email | Password |
|---|---|---|
| Admin | admin@gmail.com | Admin@12345 |
| Instructor | priya@gmail.com | Priya@12345 |
| Instructor | rahul@gmail.com | Rahul@12345 |
| Student | anjali@gmail.com | Anjali@12345 |
| Student | sneha@gmail.com | Sneha@12345 |
| Student | arjun@gmail.com | Arjun@12345 |

Change demo passwords after first login in a real deployment. Passwords created through registration and the seed script are stored as bcrypt hashes. The project does not include a password-change screen yet.

## Important notes

- The application uses your local MySQL database. It does not connect to MySQL Workbench itself; Workbench is the tool used to create and inspect the database.
- The `.env` file is private and is excluded from Git by `.gitignore`.
- Course images are loaded from Unsplash URLs, so an internet connection is needed to display those remote photos.
- Uploaded learning materials are saved in the local `uploads/` directory. Back up this folder if you need to preserve uploaded files.
- This is a college/demo project starter. Before public deployment, configure HTTPS, a persistent session store, CSRF protection, stronger upload scanning and production secrets.
- Enrollment payment status is managed manually by the admin; no real payment gateway is connected.
- Enrolled students can use the “Mark progress” action on course lessons to update their course progress. Admins can also edit progress from enrollment management.

## Project structure

```text
TEENA_THANMAY_LMS/
├── public/
│   ├── css/style.css
│   └── js/main.js
├── uploads/
├── views/
│   ├── partials/
│   ├── home.ejs
│   ├── login.ejs
│   ├── register.ejs
│   ├── courses.ejs
│   ├── course-detail.ejs
│   ├── dashboard.ejs
│   ├── my-learning.ejs
│   ├── users.ejs
│   ├── enrollments.ejs
│   ├── course-form.ejs
│   ├── lesson-form.ejs
│   ├── about.ejs
│   └── error.ejs
├── .env.example
├── database.sql
├── seed.js
├── server.js
└── package.json
```
