require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'teena_thanmay_lms',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'please-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|ppt|pptx|txt|mp4|webm|png|jpg|jpeg)$/i.test(file.originalname);
    cb(allowed ? null : new Error('Unsupported file type.'), allowed);
  }
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});
function flash(req, message, type='success') { req.session.flash = { message, type }; }
function requireLogin(req, res, next) {
  if (!req.session.user) { flash(req, 'Please sign in to continue.', 'warning'); return res.redirect('/login'); }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      flash(req, 'You do not have permission to access that page.', 'danger');
      return res.redirect('/dashboard');
    }
    next();
  };
}
const isStaff = user => user && ['admin','instructor'].includes(user.role);

app.get('/', async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT c.*, u.name AS instructor_name,
       (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.course_id) AS lesson_count
       FROM courses c JOIN users u ON c.instructor_id=u.user_id
       ORDER BY c.created_at DESC LIMIT 6`
    );
    res.render('home', { title: 'Learn without limits', courses });
  } catch (e) { res.render('home', { title: 'Learn without limits', courses: [] }); }
});

app.get('/register', (req,res) => res.render('register', { title:'Create account' }));
app.post('/register', async (req,res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      flash(req, 'Enter your name, valid email and a password of at least 8 characters.', 'warning');
      return res.redirect('/register');
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.execute("INSERT INTO users (name,email,password,role) VALUES (?,?,?,'student')", [name.trim(), email.trim().toLowerCase(), hash]);
    flash(req, 'Your student account has been created. Please sign in.');
    res.redirect('/login');
  } catch (e) {
    flash(req, e.code === 'ER_DUP_ENTRY' ? 'That email is already registered.' : 'Could not create account. Check your database.', 'danger');
    res.redirect('/register');
  }
});
app.get('/login', (req,res) => res.render('login', { title:'Welcome back' }));
app.post('/login', async (req,res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [String(req.body.email || '').trim().toLowerCase()]);
    if (!rows.length || !(await bcrypt.compare(req.body.password || '', rows[0].password))) {
      flash(req, 'Incorrect email or password.', 'danger'); return res.redirect('/login');
    }
    const u = rows[0];
    req.session.user = { user_id:u.user_id, name:u.name, email:u.email, role:u.role };
    res.redirect('/dashboard');
  } catch (e) { flash(req, 'Unable to sign in. Check your database connection.', 'danger'); res.redirect('/login'); }
});
app.post('/logout', requireLogin, (req,res) => req.session.destroy(() => res.redirect('/')));

app.get('/dashboard', requireLogin, async (req,res) => {
  try {
    const u = req.session.user;
    let stats = {};
    let recent = [];
    if (u.role === 'admin') {
      const [[users]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='student'");
      const [[instructors]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='instructor'");
      const [[courses]] = await pool.query('SELECT COUNT(*) AS total FROM courses');
      const [[enrollments]] = await pool.query('SELECT COUNT(*) AS total FROM enrollments');
      const [[revenue]] = await pool.query("SELECT COALESCE(SUM(fee),0) AS total FROM enrollments WHERE payment_status='paid'");
      stats = { students:users.total, instructors:instructors.total, courses:courses.total, enrollments:enrollments.total, revenue:revenue.total };
      [recent] = await pool.query(`SELECT e.*,u.name AS student_name,c.title AS course_title FROM enrollments e JOIN users u ON e.user_id=u.user_id JOIN courses c ON e.course_id=c.course_id ORDER BY e.enrollment_date DESC LIMIT 7`);
    } else if (u.role === 'instructor') {
      const [[courses]] = await pool.execute('SELECT COUNT(*) AS total FROM courses WHERE instructor_id=?',[u.user_id]);
      const [[lessons]] = await pool.execute('SELECT COUNT(*) AS total FROM lessons l JOIN courses c ON l.course_id=c.course_id WHERE c.instructor_id=?',[u.user_id]);
      const [[enrollments]] = await pool.execute('SELECT COUNT(*) AS total FROM enrollments e JOIN courses c ON e.course_id=c.course_id WHERE c.instructor_id=?',[u.user_id]);
      stats = { courses:courses.total, lessons:lessons.total, enrollments:enrollments.total };
      [recent] = await pool.execute(`SELECT e.*,u.name AS student_name,c.title AS course_title FROM enrollments e JOIN users u ON e.user_id=u.user_id JOIN courses c ON e.course_id=c.course_id WHERE c.instructor_id=? ORDER BY e.enrollment_date DESC LIMIT 7`,[u.user_id]);
    } else {
      const [[enrollments]] = await pool.execute('SELECT COUNT(*) AS total FROM enrollments WHERE user_id=?',[u.user_id]);
      const [[completed]] = await pool.execute("SELECT COUNT(*) AS total FROM enrollments WHERE user_id=? AND enrollment_status='completed'",[u.user_id]);
      stats = { enrollments:enrollments.total, completed:completed.total };
      [recent] = await pool.execute(`SELECT e.*,c.title AS course_title,c.image_url FROM enrollments e JOIN courses c ON e.course_id=c.course_id WHERE e.user_id=? ORDER BY e.enrollment_date DESC`,[u.user_id]);
    }
    res.render('dashboard',{title:'Dashboard',stats,recent});
  } catch(e) { console.error(e); flash(req,'Dashboard could not load. Check that the SQL tables are created.','danger'); res.redirect('/'); }
});

app.get('/courses', async (req,res) => {
  const q = String(req.query.q || '').trim();
  const [courses] = await pool.query(
    `SELECT c.*,u.name AS instructor_name,
     (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.course_id) AS lesson_count
     FROM courses c JOIN users u ON c.instructor_id=u.user_id
     WHERE c.title LIKE ? OR c.description LIKE ? ORDER BY c.created_at DESC`,
    [`%${q}%`,`%${q}%`]
  );
  res.render('courses',{title:'Explore courses',courses,q});
});
app.get('/courses/:id', async (req,res) => {
  const [rows] = await pool.execute(`SELECT c.*,u.name AS instructor_name FROM courses c JOIN users u ON c.instructor_id=u.user_id WHERE c.course_id=?`,[req.params.id]);
  if (!rows.length) return res.status(404).render('error',{title:'Course not found',message:'This course could not be found.'});
  const [lessons] = await pool.execute('SELECT * FROM lessons WHERE course_id=? ORDER BY lesson_order',[req.params.id]);
  let enrolled = false;
  if (req.session.user?.role === 'student') {
    const [e] = await pool.execute('SELECT enrollment_id FROM enrollments WHERE user_id=? AND course_id=?',[req.session.user.user_id,req.params.id]);
    enrolled = e.length > 0;
  }
  res.render('course-detail',{title:rows[0].title,course:rows[0],lessons,enrolled});
});
app.post('/courses/:id/enroll', requireLogin, requireRole('student'), async (req,res) => {
  try {
    const [[course]] = await pool.execute('SELECT * FROM courses WHERE course_id=?',[req.params.id]);
    if (!course) { flash(req,'Course not found.','danger'); return res.redirect('/courses'); }
    await pool.execute('INSERT INTO enrollments (user_id,course_id,fee,payment_status) VALUES (?,?,?,"pending")',[req.session.user.user_id,course.course_id,course.price]);
    flash(req,'Enrollment successful. Your fee is marked as pending until payment is confirmed.');
  } catch(e) { flash(req,e.code==='ER_DUP_ENTRY'?'You are already enrolled in this course.':'Could not enroll in this course.','warning'); }
  res.redirect('/courses/'+req.params.id);
});

app.get('/my-learning', requireLogin, requireRole('student'), async (req,res) => {
  const [enrollments] = await pool.execute(`SELECT e.*,c.title,c.description,c.image_url,c.course_id FROM enrollments e JOIN courses c ON e.course_id=c.course_id WHERE e.user_id=? ORDER BY e.enrollment_date DESC`,[req.session.user.user_id]);
  res.render('my-learning',{title:'My learning',enrollments});
});
app.post('/lessons/:id/complete', requireLogin, requireRole('student'), async (req,res) => {
  const [[lesson]] = await pool.execute('SELECT course_id FROM lessons WHERE lesson_id=?',[req.params.id]);
  if (!lesson) return res.redirect('/my-learning');
  const [owned] = await pool.execute('SELECT enrollment_id FROM enrollments WHERE user_id=? AND course_id=?',[req.session.user.user_id,lesson.course_id]);
  if (!owned.length) { flash(req,'Enroll in this course to track lessons.','warning'); return res.redirect('/courses/'+lesson.course_id); }
  const [[total]] = await pool.execute('SELECT COUNT(*) AS n FROM lessons WHERE course_id=?',[lesson.course_id]);
  const [[done]] = await pool.execute('SELECT COUNT(*) AS n FROM lessons WHERE course_id=? AND lesson_id<=?',[lesson.course_id,req.params.id]);
  const progress = total.n ? Math.min(100, Math.round(done.n/total.n*100)) : 0;
  await pool.execute("UPDATE enrollments SET progress=?, enrollment_status=? WHERE user_id=? AND course_id=?",[progress,progress===100?'completed':'active',req.session.user.user_id,lesson.course_id]);
  flash(req,'Your course progress has been updated.');
  res.redirect('/my-learning');
});

app.get('/admin/users', requireLogin, requireRole('admin'), async (req,res) => {
  const [users] = await pool.query('SELECT user_id,name,email,role,created_at FROM users ORDER BY created_at DESC');
  res.render('users',{title:'Manage users',users});
});
app.post('/admin/users', requireLogin, requireRole('admin'), async (req,res) => {
  try {
    const {name,email,password,role} = req.body;
    if (!name || !email || !password || !['admin','instructor','student'].includes(role)) throw new Error('Fill all fields correctly.');
    const hash = await bcrypt.hash(password,12);
    await pool.execute('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',[name,email.toLowerCase(),hash,role]);
    flash(req,'User account created.');
  } catch(e) { flash(req,e.code==='ER_DUP_ENTRY'?'That email already exists.':e.message,'danger'); }
  res.redirect('/admin/users');
});
app.post('/admin/users/:id/delete', requireLogin, requireRole('admin'), async (req,res) => {
  if (Number(req.params.id) === req.session.user.user_id) { flash(req,'You cannot delete your own signed-in account.','warning'); return res.redirect('/admin/users'); }
  try { await pool.execute('DELETE FROM users WHERE user_id=?',[req.params.id]); flash(req,'User deleted. Users linked to courses or enrollments cannot be deleted until those records are removed.'); }
  catch(e) { flash(req,'This user is linked to courses or enrollments. Remove those records first.','warning'); }
  res.redirect('/admin/users');
});

app.get('/admin/courses/new', requireLogin, requireRole('admin','instructor'), async (req,res) => {
  const [instructors] = await pool.query("SELECT user_id,name FROM users WHERE role='instructor' ORDER BY name");
  res.render('course-form',{title:'Add a course',instructors,course:null});
});
app.post('/admin/courses', requireLogin, requireRole('admin','instructor'), async (req,res) => {
  try {
    const {title,description,instructor_id,price,image_url} = req.body;
    const owner = req.session.user.role==='admin' ? Number(instructor_id) : req.session.user.user_id;
    await pool.execute('INSERT INTO courses (title,description,instructor_id,price,image_url) VALUES (?,?,?,?,?)',[title,description,owner,Number(price||0),image_url||null]);
    flash(req,'Course added successfully.');
  } catch(e) { flash(req,'Could not add course. Check the course details.','danger'); }
  res.redirect('/courses');
});
app.get('/admin/courses/:id/edit', requireLogin, requireRole('admin','instructor'), async (req,res) => {
  const [rows] = await pool.execute('SELECT * FROM courses WHERE course_id=?',[req.params.id]);
  if (!rows.length || (req.session.user.role==='instructor' && rows[0].instructor_id!==req.session.user.user_id)) return res.redirect('/courses');
  const [instructors] = await pool.query("SELECT user_id,name FROM users WHERE role='instructor'");
  res.render('course-form',{title:'Edit course',instructors,course:rows[0]});
});
app.post('/admin/courses/:id/edit', requireLogin, requireRole('admin','instructor'), async (req,res) => {
  const {title,description,instructor_id,price,image_url} = req.body;
  const owner = req.session.user.role==='admin' ? Number(instructor_id) : req.session.user.user_id;
  const [result] = await pool.execute('UPDATE courses SET title=?,description=?,instructor_id=?,price=?,image_url=? WHERE course_id=?',[title,description,owner,Number(price||0),image_url||null,req.params.id]);
  flash(req,result.affectedRows?'Course updated.':'Course was not changed.'); res.redirect('/courses');
});
app.post('/admin/courses/:id/delete', requireLogin, requireRole('admin'), async (req,res) => {
  try { await pool.execute('DELETE FROM courses WHERE course_id=?',[req.params.id]); flash(req,'Course deleted.'); }
  catch(e) { flash(req,'Could not delete course because it has enrollment records.','warning'); }
  res.redirect('/courses');
});

app.get('/courses/:id/lessons/new', requireLogin, requireRole('admin','instructor'), async (req,res) => {
  const [[course]] = await pool.execute('SELECT * FROM courses WHERE course_id=?',[req.params.id]);
  if (!course || (req.session.user.role==='instructor' && course.instructor_id!==req.session.user.user_id)) return res.redirect('/courses');
  res.render('lesson-form',{title:'Add lesson',course});
});
app.post('/courses/:id/lessons', requireLogin, requireRole('admin','instructor'), upload.single('material_file'), async (req,res) => {
  try {
    const [[course]] = await pool.execute('SELECT * FROM courses WHERE course_id=?',[req.params.id]);
    if (!course || (req.session.user.role==='instructor' && course.instructor_id!==req.session.user.user_id)) return res.redirect('/courses');
    const materialUrl = req.file ? '/uploads/'+req.file.filename : (req.body.material_url || '');
    await pool.execute('INSERT INTO lessons (course_id,title,description,lesson_order,material_type,material_url) VALUES (?,?,?,?,?,?)',
      [req.params.id,req.body.title,req.body.description,Number(req.body.lesson_order||1),req.body.material_type,materialUrl]);
    flash(req,'Lesson added successfully.');
  } catch(e) { flash(req,'Could not add lesson. Check the details and file size.','danger'); }
  res.redirect('/courses/'+req.params.id);
});

app.get('/admin/enrollments', requireLogin, requireRole('admin'), async (req,res) => {
  const [enrollments] = await pool.query(`SELECT e.*,u.name AS student_name,c.title AS course_title FROM enrollments e JOIN users u ON e.user_id=u.user_id JOIN courses c ON e.course_id=c.course_id ORDER BY e.enrollment_date DESC`);
  const [students] = await pool.query("SELECT user_id,name FROM users WHERE role='student' ORDER BY name");
  const [courses] = await pool.query('SELECT course_id,title,price FROM courses ORDER BY title');
  res.render('enrollments',{title:'Manage enrollments',enrollments,students,courses});
});
app.post('/admin/enrollments', requireLogin, requireRole('admin'), async (req,res) => {
  try {
    const [[course]] = await pool.execute('SELECT price FROM courses WHERE course_id=?',[req.body.course_id]);
    if (!course) throw new Error('Choose a valid course.');
    await pool.execute('INSERT INTO enrollments (user_id,course_id,fee,payment_status) VALUES (?,?,?,?)',[req.body.user_id,req.body.course_id,Number(req.body.fee ?? course.price),req.body.payment_status || 'pending']);
    flash(req,'Enrollment created.');
  } catch(e) { flash(req,e.code==='ER_DUP_ENTRY'?'This student is already enrolled in this course.':e.message,'danger'); }
  res.redirect('/admin/enrollments');
});
app.post('/admin/enrollments/:id/update', requireLogin, requireRole('admin'), async (req,res) => {
  await pool.execute('UPDATE enrollments SET fee=?,payment_status=?,progress=?,enrollment_status=? WHERE enrollment_id=?',
    [Number(req.body.fee),req.body.payment_status,Math.max(0,Math.min(100,Number(req.body.progress))),req.body.enrollment_status,req.params.id]);
  flash(req,'Enrollment updated.'); res.redirect('/admin/enrollments');
});
app.post('/admin/enrollments/:id/delete', requireLogin, requireRole('admin'), async (req,res) => {
  await pool.execute('DELETE FROM enrollments WHERE enrollment_id=?',[req.params.id]);
  flash(req,'Enrollment deleted.'); res.redirect('/admin/enrollments');
});

app.get('/about',(req,res)=>res.render('about',{title:'About us'}));
app.use((req,res)=>res.status(404).render('error',{title:'Page not found',message:'The page you are looking for does not exist.'}));
app.use((err,req,res,next)=>{
  console.error(err);
  flash(req,err.message || 'Something went wrong.','danger');
  res.redirect('back');
});

(async () => {
  try {
    await pool.query('SELECT 1');
    app.listen(PORT,()=>console.log(`TEENA THANMAY LMS running at http://localhost:${PORT}`));
  } catch(e) {
    console.error('MySQL connection failed:',e.message);
    console.error('Check your .env file and make sure MySQL80 is running.');
    process.exit(1);
  }
})();
