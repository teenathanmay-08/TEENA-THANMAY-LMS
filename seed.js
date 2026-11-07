require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'teena_thanmay_lms'
  });

  const demoUsers = [
    ['Teena Thanmay', 'admin@gmail.com', 'Admin@12345', 'admin'],
    ['Priya Sharma', 'priya@gmail.com', 'Priya@12345', 'instructor'],
    ['Rahul Kumar', 'rahul@gmail.com', 'Rahul@12345', 'instructor'],
    ['Anjali Reddy', 'anjali@gmail.com', 'Anjali@12345', 'student'],
    ['Sneha Patel', 'sneha@gmail.com', 'Sneha@12345', 'student'],
    ['Arjun Kumar', 'arjun@gmail.com', 'Arjun@12345', 'student']
  ];

  for (const [name, email, plainPassword, role] of demoUsers) {
    const [found] = await db.execute('SELECT user_id FROM users WHERE email=?', [email]);
    const hash = await bcrypt.hash(plainPassword, 12);
    if (!found.length) {
      await db.execute(
        'INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
        [name, email, hash, role]
      );
    } else {
      // Refresh demo-account passwords as bcrypt hashes, including accounts
      // that may have been inserted earlier with placeholder SQL passwords.
      await db.execute(
        'UPDATE users SET name=?, password=?, role=? WHERE email=?',
        [name, hash, role, email]
      );
    }
  }

  const [instructors] = await db.execute(
    "SELECT user_id,email FROM users WHERE role='instructor' ORDER BY user_id"
  );
  const instructorId = (email) => instructors.find(x => x.email === email)?.user_id || instructors[0]?.user_id;

  const courses = [
    ['HTML & CSS','Learn website structure, styling and responsive layouts.',instructorId('priya@gmail.com'),999,'https://images.unsplash.com/photo-1498050108023-c5249f4df085'],
    ['JavaScript','Learn modern JavaScript, DOM and interactive websites.',instructorId('priya@gmail.com'),1499,'https://images.unsplash.com/photo-1627398242454-45a1465c2479'],
    ['Python Programming','Learn Python from beginner to advanced concepts.',instructorId('rahul@gmail.com'),1999,'https://images.unsplash.com/photo-1526379095098-d400fd0bf935'],
    ['Java Programming','Master Java fundamentals and object-oriented programming.',instructorId('rahul@gmail.com'),1999,'https://images.unsplash.com/photo-1517694712202-14dd9538aa97'],
    ['Full Stack Web Development','Build complete web applications using frontend and backend tools.',instructorId('priya@gmail.com'),3999,'https://images.unsplash.com/photo-1461749280684-dccba630e2f6'],
    ['MERN Stack Development','Learn MongoDB, Express, React and Node.js.',instructorId('rahul@gmail.com'),3499,'https://images.unsplash.com/photo-1555066931-4365d14bab8c'],
    ['Data Science','Explore data analysis, Python and visualization.',instructorId('rahul@gmail.com'),2999,'https://images.unsplash.com/photo-1551288049-bebda4e38f71'],
    ['Artificial Intelligence & ML','Understand AI concepts and machine learning foundations.',instructorId('priya@gmail.com'),3499,'https://images.unsplash.com/photo-1677442136019-21780ecad995'],
    ['SQL & Database Management','Learn relational databases, SQL queries and data design.',instructorId('rahul@gmail.com'),1499,'https://images.unsplash.com/photo-1544383835-bda2bc66a55d'],
    ['UI/UX Design','Learn user interface design and user experience principles.',instructorId('priya@gmail.com'),1999,'https://images.unsplash.com/photo-1561070791-2526d30994b5']
  ];

  for (const c of courses) {
    const [found] = await db.execute('SELECT course_id FROM courses WHERE title=?', [c[0]]);
    if (!found.length && c[2]) {
      await db.execute(
        'INSERT INTO courses (title,description,instructor_id,price,image_url) VALUES (?,?,?,?,?)', c
      );
    }
  }

  const [allCourses] = await db.execute('SELECT course_id,title FROM courses');
  const lessonTemplates = {
    'HTML & CSS': ['HTML Introduction','HTML Elements and Forms','CSS Introduction','Responsive CSS Layouts'],
    'JavaScript': ['JavaScript Basics','Variables and Data Types','Functions and Events','DOM Manipulation'],
    'Python Programming': ['Python Introduction','Variables and Data Types','Conditions and Loops','Functions'],
    'Java Programming': ['Java Basics','Classes and Objects','Inheritance','Exception Handling'],
    'Full Stack Web Development': ['Frontend Fundamentals','Backend Development','Working with APIs','Database Integration'],
    'MERN Stack Development': ['React Introduction','Node.js and Express','MongoDB Basics','Building a MERN App'],
    'Data Science': ['Introduction to Data Science','Data Cleaning','Data Visualization','Intro to Machine Learning'],
    'Artificial Intelligence & ML': ['Introduction to AI','Machine Learning Basics','Model Training','Model Evaluation'],
    'SQL & Database Management': ['SQL Introduction','SELECT Queries','Joins and Relationships','Database Design'],
    'UI/UX Design': ['UI Design Basics','Color and Typography','Wireframing','UX Research']
  };

  for (const course of allCourses) {
    const [count] = await db.execute('SELECT COUNT(*) AS total FROM lessons WHERE course_id=?', [course.course_id]);
    if (count[0].total === 0) {
      const names = lessonTemplates[course.title] || ['Introduction','Core Concepts','Practical Exercise'];
      for (let i = 0; i < names.length; i++) {
        await db.execute(
          'INSERT INTO lessons (course_id,title,description,lesson_order,material_type) VALUES (?,?,?,?,?)',
          [course.course_id, names[i], `Learn ${names[i].toLowerCase()} with examples and practice.`, i + 1, 'notes']
        );
      }
    }
  }

  const [students] = await db.execute("SELECT user_id FROM users WHERE role='student' ORDER BY user_id");
  const [courseRows] = await db.execute('SELECT course_id,price FROM courses ORDER BY course_id');
  const examples = [
    [students[0]?.user_id, courseRows[0]?.course_id, courseRows[0]?.price, 'paid', 50, 'active'],
    [students[0]?.user_id, courseRows[1]?.course_id, courseRows[1]?.price, 'paid', 25, 'active'],
    [students[1]?.user_id, courseRows[2]?.course_id, courseRows[2]?.price, 'pending', 0, 'active'],
    [students[1]?.user_id, courseRows[4]?.course_id, courseRows[4]?.price, 'paid', 75, 'active'],
    [students[2]?.user_id, courseRows[3]?.course_id, courseRows[3]?.price, 'paid', 100, 'completed']
  ];
  for (const e of examples) {
    if (e.every(v => v !== undefined)) {
      const [found] = await db.execute('SELECT enrollment_id FROM enrollments WHERE user_id=? AND course_id=?', [e[0],e[1]]);
      if (!found.length) await db.execute(
        'INSERT INTO enrollments (user_id,course_id,fee,payment_status,progress,enrollment_status) VALUES (?,?,?,?,?,?)', e
      );
    }
  }

  console.log('Seed completed. Demo accounts:');
  console.log('Admin: admin@gmail.com / Admin@12345');
  console.log('Instructor: priya@gmail.com / Priya@12345');
  console.log('Instructor: rahul@gmail.com / Rahul@12345');
  console.log('Students: anjali@gmail.com / Anjali@12345, sneha@gmail.com / Sneha@12345');
  await db.end();
}

run().catch(err => { console.error(err); process.exit(1); });
