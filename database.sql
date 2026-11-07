-- TEENA THANMAY LMS
-- Run this if you are creating the database for the first time.
-- If the database and four tables already exist, do not DROP them.
CREATE DATABASE IF NOT EXISTS teena_thanmay_lms;
USE teena_thanmay_lms;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','instructor','student') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  instructor_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(user_id)
);

-- Add the course image column when upgrading an older courses table.
SET @image_col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'image_url'
);
SET @image_col_sql = IF(
  @image_col_exists = 0,
  'ALTER TABLE courses ADD COLUMN image_url VARCHAR(500)',
  'SELECT ''courses.image_url already exists'' AS setup_message'
);
PREPARE image_col_stmt FROM @image_col_sql;
EXECUTE image_col_stmt;
DEALLOCATE PREPARE image_col_stmt;

CREATE TABLE IF NOT EXISTS lessons (
  lesson_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  lesson_order INT DEFAULT 1,
  material_type ENUM('video','pdf','document','link','notes') DEFAULT 'notes',
  material_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('pending','paid','failed') DEFAULT 'pending',
  progress DECIMAL(5,2) DEFAULT 0.00,
  enrollment_status ENUM('active','completed','cancelled') DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  UNIQUE (user_id, course_id)
);
