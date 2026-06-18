import { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  storage,
  signInWithEmailAndPassword, 
  signOut, 
  collection, 
  doc, 
  onSnapshot,
  query,
  orderBy,
  setDoc,
  writeBatch,
  deleteDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getDocs,
  updateDoc
} from './firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Plus, Trash2, Trophy, Users, ShieldCheck, UserCog, Upload, Image as ImageIcon, Loader2, Download, Power, PowerOff, ArrowLeft, BarChart3, LayoutDashboard, AlertTriangle, ListChecks, X, RotateCcw, Search, Filter, Bomb, Eye, EyeOff, Play, SkipForward, Rewind, Megaphone, Repeat, Printer, Activity, ClipboardCheck, Lock, Delete } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';

interface Project {
  id: string;
  title: string;
  instructor: string;
  team_members: string;
  section_number?: string;
  status?: 'none' | 'verified' | 'rejected';
  imageUrl?: string;
  finalVotes?: number;
}

interface VoteResult {
  id: string;
  title: string;
  instructor: string;
  votes: number;
}

interface Judge {
  id: string;
  name: string;
  title: string;
  department: string;
  email: string;
  registeredAt: number;
}

interface AdminPanelProps {
    onBack: () => void;
    lang: 'en' | 'ar';
    setLang: (l: 'en' | 'ar') => void;
}

export default function AdminPanel({ onBack, lang, setLang }: AdminPanelProps) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'master' | 'organizer' | 'media' | null>(null);

  // Vault PIN Security State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [funnyError, setFunnyError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const CORRECT_PIN = '2026';

  const errorMessages = [
    "Nice try. Maybe next year you'll gain access.",
    "Access Denied. The cyber-police have been notified. (Just kidding)",
    "Incorrect PIN. Are you sure you are an admin?",
    "Wrong. Please step away from the keyboard.",
    "Error 403: Hacker detected. Deploying countermeasures...",
    "Nope. The vault remains sealed."
  ];

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === CORRECT_PIN) {
          setIsLocked(false);
        } else {
          setPinError(true);
          const randomMsg = errorMessages[Math.floor(Math.random() * errorMessages.length)];
          setFunnyError(randomMsg);
          setTimeout(() => { setPin(''); setPinError(false); setFunnyError(null); }, 2500);
        }
      }
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };
  const [activeTab, setActiveTab] = useState<'dashboard' | 'teams' | 'judges' | 'gallery' | 'stage' | 'media'>('dashboard');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [archiveMode, setArchiveMode] = useState(false);

  // Judges State
  const [judges, setJudges] = useState<Judge[]>([]);
  const [newJudge, setNewJudge] = useState({ name: '', title: '', department: '', email: '' });
  const [addingJudge, setAddingJudge] = useState(false);
  const [judgeSearch, setJudgeSearch] = useState('');
  
  // Kiosk Stage Controls
  const [kioskConfig, setKioskConfig] = useState<{
      hideResults: boolean;
      victoryMode: boolean;
      revealStep: number;
      isPaused: boolean;
      autoRotate: boolean;
      tickerText: string;
      organizerNames: string;
      headOrganizerNames: string;
      volunteerNames: string;
      instructorNamesExtra: string;
      ceremonySelection?: string[];
      hofSelection?: string[];
  }>({
      hideResults: false,
      victoryMode: false,
      revealStep: 0,
      isPaused: true,
      autoRotate: false,
      tickerText: "",
      organizerNames: "",
      headOrganizerNames: "",
      volunteerNames: "",
      instructorNamesExtra: "",
      ceremonySelection: ['', '', '', '', '']
  });

  const [newProject, setNewProject] = useState({
    title: '',
    instructor: '',
    team_members: '',
    section_number: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<FileList | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{id: string, imageUrl: string, timestamp: number}[]>([]);

  // Search and Sort State
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [teamSortBy, setTeamSortBy] = useState<'title' | 'instructor' | 'section' | 'status'>('title');

  // Attendance State
  const [attendancePopout, setAttendancePopout] = useState<string | null>(null); // project id
  const [attendance, setAttendance] = useState<Record<string, Record<string, boolean>>>({}); // { projectId: { memberName: true/false } }

  // Load attendance from Firestore on mount
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'attendance'), (snap) => {
      const data: Record<string, Record<string, boolean>> = {};
      snap.forEach(d => { data[d.id] = d.data() as Record<string, boolean>; });
      setAttendance(data);
    }, (e) => console.warn("Admin Attendance listener:", e));
    return () => unsub();
  }, []);

  const toggleAttendance = async (projectId: string, member: string, checked: boolean) => {
    const updated = { ...(attendance[projectId] || {}), [member]: checked };
    setAttendance(prev => ({ ...prev, [projectId]: updated }));
    await setDoc(doc(db, 'attendance', projectId), updated, { merge: true });
  };

  const getAttendanceStatus = (projectId: string, members: string[]) => {
    const a = attendance[projectId] || {};
    const checked = members.filter(m => a[m.trim()]);
    if (checked.length === 0) return 'none';
    if (checked.length === members.length) return 'full';
    return 'partial';
  };

  // Single-batch write for Mark All / Clear All
  const setAllAttendance = async (projectId: string, members: string[], value: boolean) => {
    const updated: Record<string, boolean> = {};
    members.forEach(m => { updated[m] = value; });
    setAttendance(prev => ({ ...prev, [projectId]: updated }));
    await setDoc(doc(db, 'attendance', projectId), updated);
  };

  // Elite Features State
  const [selectedPlacard, setSelectedPlacard] = useState<Project | null>(null);
  const [velocityMap, setVelocityMap] = useState<Record<string, number>>({});
  const prevResultsRef = useRef<Record<string, number>>({});

  const t = {
    en: {
      back: "Back to Expo",
      login_title: "Organizers Secure Portal",
      authorized: "Authorized HTU Personnel Only",
      sys_user: "System Username",
      sys_pass: "Security Password",
      init: "Initialize Session",
      invalid: "Invalid username or password.",
      sys: "SYSTEM:",
      voting_active: "Voting Active",
      voting_paused: "Voting Paused",
      export: "Export Data",
      logout: "Terminate Session",
      tot_projects: "Total Projects",
      tot_votes: "Total Votes Cast",
      add_title: "Register New Project",
      p_title: "Project Title",
      p_inst: "Section Instructor",
      p_team: "Team Members",
      p_section: "Section Number",
      attach: "Attach Project Visual",
      deploy: "Deploy Project",
      top_ranked: "Top Ranked Projects",
      votes_txt: "votes",
      inventory: "Expo Inventory Management",
      th_visual: "Visual",
      th_id: "Project Identity",
      th_inst: "Section Instructor",
      th_score: "Score",
      th_ops: "Operations",
      missing: "Missing",
      add_photo: "Add Photo",
      update: "Update",
      critical: "Critical Vote Reset",
      critical_desc: "Wipes all vote tallies and voter session hashes.",
      purge: "Purge All Voting Data",
      purge_prompt: "DANGER: This will delete ALL votes. Type 'RESET' to confirm:",
      hard_reset: "Complete Platform Wipe",
      hard_reset_desc: "DELETES EVERYTHING: Projects, Results, Gallery, and Voters. High level reset.",
      hard_reset_btn: "Perform Hard Reset",
      hard_reset_prompt: "ULTIMATE DANGER: This will wipe the ENTIRE database. Type 'HARD RESET' to confirm:",
      archive_mode: "Post-Event Archive Mode",
      archive_desc: "Locks voting globally and sorts the public grid by final results. This action cannot be reversed without a developer.",
      archive_btn: "Activate Archive Mode",
      archive_prompt: "WARNING: This permanently cements the final votes into the public view. Type 'ARCHIVE' to confirm:",
      footer_text: "Made and Engineered by NAJDAWI",
      gallery_mgmt: "Live Event Gallery Management",
      upload_gallery: "Upload Event Photo",
      uploading: "Uploading...",
      delete: "Delete",
      tab_dashboard: "Dashboard",
      tab_teams: "Teams Management",
      tab_judges: "Judges",
      tab_gallery: "Gallery",
      tab_stage: "Stage Control",
      tab_media: "Media Upload",
      th_members: "Team Members",
      th_section: "Section",
      th_team_id: "Team ID",
      th_verify: "Verification",
      search_teams: "Search by team, instructor, member name, or ID...",
      sort_by: "Sort By",
      sort_title: "Team Name",
      sort_instructor: "Instructor",
      sort_section: "Section",
      sort_status: "Verification Status",
      stage_title: "Kiosk Stage Orchestration",
      stage_desc: "Control exactly what the audience sees on the big screens.",
      hide_results: "Glitch-Mask All Display Info",
      show_results: "Reveal Clear Info",
      victory_start: "Start Victory Reveal",
      victory_stop: "Exit Victory Mode",
      reveal_next: "Next Reveal Step",
      reveal_reset: "Reset Reveal",
      ceremony_step_0: "INTRO COUNTDOWN",
      ceremony_step_1: "SPECIAL THANKS",
      ceremony_step_2: "UNDER THE PATRONAGE OF",
      ceremony_step_3: "SPECIAL THANKS",
      ceremony_step_4: "OUR INSTRUCTORS",
      ceremony_step_5: "THE EXPO ORGANIZERS",
      ceremony_step_6: "THE HEAD ORGANIZERS",
      ceremony_step_7: "SPECIAL RECOGNITION",
      ceremony_step_8: "OUR VOLUNTEERS",
      ceremony_step_9: "THE 4TH PLACE - JUDGING AWARD",
      ceremony_step_10: "THE 3RD PLACE - JUDGING AWARD",
      ceremony_step_11: "THE 2ND PLACE - JUDGING AWARD",
      ceremony_step_12: "THE GRAND CHAMPION 2026",
      ceremony_step_13: "VOTING PLATFORM ANALYTICS",
      ceremony_step_14: "FAN FAVORITE",
      auto_rotate_on: "Auto-Rotate Active",
      auto_rotate_off: "Static Display",
      ticker_label: "Live News Ticker Announcement",
      ticker_placeholder: "Type a public announcement...",
      inst_extra_label: "Extra Instructor Names (Comma separated)",
      head_org_names_label: "Head Organizers (e.g. John, Jane)",
      org_names_label: "Organizers Names (Comma separated)",
      org_names_placeholder: "John Doe, Jane Doe, etc...",
      vol_names_label: "Volunteer Names (Comma separated)",
      print_placard: "Print",
      security_title: "Anti-Bot & Velocity Dashboard",
      media_title: "Media Team Cloud Portal",
      media_desc: "Capture and beam live event moments directly to the main expo screens.",
      drop_images: "Drop your masterpieces here or click to browse",
      files_selected: "Images ready for upload",
      upload_to_cloud: "Beam to Cloud",
      recent_uploads: "Your Recent Captures",
      judge_title: "Judges Registration",
      judge_name: "Full Name",
      judge_job_title: "Job Title / Position",
      judge_dept: "Department / Organization",
      judge_email: "Email Address",
      judge_register: "Register Judge",
      judge_search: "Search judges by name, department, or email...",
      judge_count: "Registered Judges",
      judge_th_name: "Name",
      judge_th_title: "Position",
      judge_th_dept: "Department",
      judge_th_email: "Email",
      judge_th_date: "Registered",
      judge_delete: "Remove",
      judge_empty: "No judges registered yet."
    },
    ar: {
      back: "العودة للمعرض",
      login_title: "البوابة الأمنية للمنظمين",
      authorized: "مخصصة لكوادر جامعة الحسين التقنية فقط",
      sys_user: "اسم مستخدم النظام",
      sys_pass: "كلمة المرور الأمنية",
      init: "بدء جلسة العمل",
      invalid: "اسم المستخدم أو كلمة المرور غير صحيحة.",
      sys: "النظام:",
      voting_active: "التصويت متاح",
      voting_paused: "التصويت مغلق",
      export: "تصدير البيانات",
      logout: "إنهاء الجلسة",
      tot_projects: "إجمالي المشاريع",
      tot_votes: "إجمالي الأصوات",
      add_title: "تسجيل مشروع جديد",
      p_title: "عنوان المشروع",
      p_inst: "مشرف الشعبة",
      p_team: "أعضاء الفريق",
      p_section: "رقم الشعبة",
      attach: "إرفاق صورة المشروع",
      deploy: "رفع المشروع",
      top_ranked: "المشاريع الأعلى تصنيفاً",
      votes_txt: "صوت",
      inventory: "إدارة مخزون المعرض",
      th_visual: "الصورة",
      th_id: "هوية المشروع",
      th_inst: "مشرف الشعبة",
      th_score: "النقاط",
      th_ops: "العمليات",
      missing: "مفقودة",
      add_photo: "إضافة صورة",
      update: "تحديث",
      critical: "مسح جميع الأصوات",
      critical_desc: "يمسح جميع الأصوات وجلسات المصوتين فقط.",
      purge: "مسح بيانات التصويت",
      purge_prompt: "تحذير: سيتم حذف جميع الأصوات. اكتب 'RESET' للتأكيد:",
      hard_reset: "تصفير المنصة بالكامل",
      hard_reset_desc: "حذف شامل: المشاريع، النتائج، المعرض، وجلسات المستخدمين.",
      hard_reset_btn: "بدء التصفير الشامل",
      hard_reset_prompt: "تحذير نهائي: سيتم مسح قاعدة البيانات بالكامل. اكتب 'HARD RESET' للتأكيد:",
      archive_mode: "وضع الأرشيف (ما بعد المعرض)",
      archive_desc: "يغلق التصويت ويفرز النتائج للجمهور. لا يمكن عكس هذا الإجراء إلا بواسطة المطور.",
      archive_btn: "تفعيل وضع الأرشيف",
      archive_prompt: "تحذير: هذا سيثبت النتائج بشكل دائم. اكتب 'ARCHIVE' للتأكيد:",
      footer_text: "تم التصميم والبرمجة بواسطة NAJDAWI",
      gallery_mgmt: "إدارة صور المعرض المباشر",
      upload_gallery: "رفع صورة جديدة",
      uploading: "جاري الرفع...",
      delete: "حذف",
      tab_dashboard: "لوحة التحكم",
      tab_teams: "إدارة الفرق",
      tab_judges: "المحكّمون",
      tab_gallery: "المعرض",
      tab_stage: "التحكم بالمسرح",
      tab_media: "بوابة الفريق الإعلامي",
      th_members: "أعضاء الفريق",
      th_section: "الشعبة",
      th_team_id: "ID الفريق",
      th_verify: "التحقق",
      search_teams: "ابحث عن فريق، مشرف، عضو، أو ID...",
      sort_by: "ترتيب حسب",
      sort_title: "اسم الفريق",
      sort_instructor: "المشرف",
      sort_section: "الشعبة",
      sort_status: "حالة التحقق",
      stage_title: "إدارة عرض المسرح (Kiosk)",
      stage_desc: "تحكم بما يظهر للجمهور على الشاشات الكبيرة بدقة.",
      hide_results: "تفعيل التشفير (Glitch)",
      show_results: "إلغاء التشفير",
      victory_start: "بدء حفل إعلان الفائزين",
      victory_stop: "إنهاء وضع الحفل",
      reveal_next: "كشف المركز التالي",
      reveal_reset: "إعادة ضبط الكشف",
      ceremony_step_0: "عد تنازلي للافتتاح",
      ceremony_step_1: "شكر خاص",
      ceremony_step_2: "تحت رعاية",
      ceremony_step_3: "شكر خاص",
      ceremony_step_4: "المدربين والأكاديميين",
      ceremony_step_5: "اللجنة المنظمة",
      ceremony_step_6: "رؤساء اللجنة المنظمة",
      ceremony_step_7: "شكر خاص",
      ceremony_step_8: "شكر للمتطوعين",
      ceremony_step_9: "المركز الرابع - اختيار التحكيم",
      ceremony_step_10: "المركز الثالث - اختيار التحكيم",
      ceremony_step_11: "المركز الثاني - اختيار التحكيم",
      ceremony_step_12: "المركز الأول - بطل المعرض",
      ceremony_step_13: "إحصائيات منصة التصويت",
      ceremony_step_14: "المشروع المفضل للجمهور",
      auto_rotate_on: "التدوير التلقائي مفعّل",
      auto_rotate_off: "عرض ثابت",
      ticker_label: "شريط الأخبار المباشر",
      ticker_placeholder: "اكتب إعلاناً عاماً للجمهور...",
      inst_extra_label: "أسماء المشرفين الإضافيين (مفصولين بفاصلة)",
      head_org_names_label: "رؤساء التنظيم (مثال: أحمد، سارة)",
      org_names_label: "أسماء المنظمين (مفصولين بفاصلة)",
      org_names_placeholder: "أحمد، سارة، إلخ...",
      vol_names_label: "أسماء المتطوعين (مفصولين بفاصلة)",
      print_placard: "طباعة",
      security_title: "لوحة المراقبة والحماية من البوتات",
      media_title: "بوابة الفريق الإعلامي السحابية",
      media_desc: "التقط وابث لحظات المعرض المباشرة مباشرة إلى الشاشات الرئيسية.",
      drop_images: "اسحب روائعك هنا أو اضغط للتصفح",
      files_selected: "صور جاهزة للرفع",
      upload_to_cloud: "بث إلى السحابة",
      recent_uploads: "آخر اللقطات المرفوعة",
      judge_title: "تسجيل المحكّمين",
      judge_name: "الاسم الكامل",
      judge_job_title: "المسمى الوظيفي",
      judge_dept: "القسم / المؤسسة",
      judge_email: "البريد الإلكتروني",
      judge_register: "تسجيل محكّم",
      judge_search: "ابحث بالاسم، القسم، أو البريد...",
      judge_count: "المحكّمون المسجلون",
      judge_th_name: "الاسم",
      judge_th_title: "المسمى",
      judge_th_dept: "القسم",
      judge_th_email: "البريد",
      judge_th_date: "تاريخ التسجيل",
      judge_delete: "حذف",
      judge_empty: "لا يوجد محكّمون مسجلون بعد."
    }
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        if (u.email === 'master@htu.local') { setRole('master'); setActiveTab('dashboard'); }
        else if (u.email === 'organizer@htu.local') { setRole('organizer'); setActiveTab('dashboard'); }
        else if (u.email === 'media@htu.local') { setRole('media'); setActiveTab('media'); }
        else setRole(null);
      } else {
        setRole(null);
      }
    });

    const qProjects = query(collection(db, 'projects'), orderBy('title', 'asc'));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
    }, (e) => console.warn("Admin Projects listener:", e));

    const qGallery = query(collection(db, 'gallery'), orderBy('timestamp', 'desc'));
    const unsubGallery = onSnapshot(qGallery, (snapshot) => {
      setGalleryImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]);
    }, (e) => console.warn("Admin Gallery listener:", e));

    const qJudges = query(collection(db, 'judges'), orderBy('registeredAt', 'desc'));
    const unsubJudges = onSnapshot(qJudges, (snapshot) => {
      setJudges(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Judge[]);
    }, (e) => console.warn("Judges listener:", e));

    const unsubKiosk = onSnapshot(doc(db, 'config', 'kiosk'), (doc) => {
        if (doc.exists()) setKioskConfig(prev => ({ ...prev, ...doc.data() as any }));
    }, (e) => console.warn("Admin Kiosk listener:", e));

    return () => {
      unsubAuth();
      unsubProjects();
      unsubGallery();
      unsubJudges();
      unsubKiosk();
    };
  }, []);

  // 5-Minute Auto-Logout (Inactivity)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 5 minutes = 300,000 ms
      timeoutId = setTimeout(() => {
        if (user) {
          auth.signOut();
          setIsLocked(true);
        }
      }, 300000);
    };

    if (user) {
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('scroll', resetTimer);
      resetTimer(); 
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [user]);

  useEffect(() => {
    let unsubResults = () => {};
    let unsubConfig = () => {};

    if (role === 'master') {
      const qResults = query(collection(db, 'results'), orderBy('votes', 'desc'));
      unsubResults = onSnapshot(qResults, (snapshot) => {
        const newResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VoteResult[];
        
        // Anti-Bot Velocity Tracking Logic
        const newVelocityMap: Record<string, number> = {};
        newResults.forEach(r => {
            const oldVotes = prevResultsRef.current[r.id] || 0;
            const diff = r.votes - oldVotes;
            if (diff > 0) newVelocityMap[r.id] = diff;
        });
        
        if (Object.keys(newVelocityMap).length > 0) {
            setVelocityMap(prev => {
                const combined = { ...prev };
                Object.keys(newVelocityMap).forEach(k => {
                    combined[k] = (combined[k] || 0) + newVelocityMap[k];
                });
                return combined;
            });
            
            // Auto-clear velocity spikes after 15 seconds
            setTimeout(() => {
                setVelocityMap(prev => {
                    const degraded = { ...prev };
                    Object.keys(newVelocityMap).forEach(k => {
                        degraded[k] = Math.max(0, degraded[k] - newVelocityMap[k]);
                        if (degraded[k] === 0) delete degraded[k];
                    });
                    return degraded;
                });
            }, 15000);
        }

        newResults.forEach(r => { prevResultsRef.current[r.id] = r.votes; });
        setResults(newResults);
      }, (e) => console.warn("Admin Results listener:", e));

      unsubConfig = onSnapshot(doc(db, 'config', 'voting'), (doc) => {
        if (doc.exists()) {
            setIsVotingOpen(doc.data().isOpen);
            setArchiveMode(doc.data().archiveMode || false);
        }
      }, (e) => console.warn("Admin Config listener:", e));
    }
    return () => {
        unsubResults();
        unsubConfig();
    };
  }, [role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = `${username.toLowerCase()}@htu.local`;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(t[lang].invalid);
    }
  };

  const toggleVoting = async () => {
    if (role !== 'master') return;
    try {
        await setDoc(doc(db, 'config', 'voting'), { isOpen: !isVotingOpen, archiveMode: archiveMode });
    } catch (e) {
        alert("Failed to toggle voting.");
    }
  };

  const handleArchiveMode = async () => {
    if (role !== 'master') return;
    if (!archiveMode) {
      const confirmText = prompt(t[lang].archive_prompt);
      if (confirmText !== 'ARCHIVE') return;
    }
    
    setUploading(true);
    try {
      await setDoc(doc(db, 'config', 'voting'), { 
         isOpen: false,
         archiveMode: !archiveMode 
      }, { merge: true });
    } catch (e) {
      console.error(e);
      alert("Failed to toggle Archive Mode.");
    }
    setUploading(false);
  };

  const updateKiosk = async (updates: Partial<typeof kioskConfig>) => {
      if (role !== 'master') return;
      try {
          await setDoc(doc(db, 'config', 'kiosk'), updates, { merge: true });
      } catch (e) {
          console.error("Kiosk Update Error:", e);
      }
  };

  const exportToExcel = () => {
    if (role !== 'master') return;
    const headers = ["Rank", "Project Title", "Section Instructor", "Votes"];
    const rows = results.map((r, i) => [
        i + 1,
        `"${r.title}"`,
        `"${r.instructor}"`,
        r.votes
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `HTU_Expo_Results_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let imageUrl = '';
      const projectId = newProject.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const projectRef = doc(db, 'projects', projectId);

      if (selectedImage) {
        const storageRef = ref(storage, `project-images/${projectId}`);
        await uploadBytes(storageRef, selectedImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      await setDoc(projectRef, { ...newProject, description: '', status: 'none', imageUrl });
      await setDoc(doc(db, 'results', projectId), {
        title: newProject.title,
        instructor: newProject.instructor,
        votes: 0
      });

      setNewProject({ title: '', instructor: '', team_members: '', section_number: '' });
      setSelectedImage(null);
      alert('Project added successfully!');
    } catch (err) {
      alert('Failed to add project.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudge.name.trim()) return;
    setAddingJudge(true);
    try {
      const judgeId = `${newJudge.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;
      await setDoc(doc(db, 'judges', judgeId), { ...newJudge, registeredAt: Date.now() });
      setNewJudge({ name: '', title: '', department: '', email: '' });
    } catch (err) {
      alert('Failed to register judge.');
    } finally {
      setAddingJudge(false);
    }
  };

  const handleDeleteJudge = async (id: string) => {
    if (window.confirm('Remove this judge?')) {
      try { await deleteDoc(doc(db, 'judges', id)); }
      catch (err) { alert('Permission denied.'); }
    }
  };

  const exportJudgesCSV = () => {
    const headers = ['Name', 'Title', 'Department', 'Email', 'Registered'];
    const rows = judges.map(j => [
      `"${j.name}"`, `"${j.title}"`, `"${j.department}"`, `"${j.email}"`,
      `"${new Date(j.registeredAt).toLocaleDateString()}"`
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `HTU_Judges_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm('Are you sure?')) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'projects', id));
        batch.delete(doc(db, 'results', id));
        await batch.commit();
        const storageRef = ref(storage, `project-images/${id}`);
        try { await deleteObject(storageRef); } catch (e) {}
      } catch (err) {
        alert('Permission denied.');
      }
    }
  };

  const handleUpdateImage = async (id: string, file: File) => {
    setUploading(true);
    try {
        const storageRef = ref(storage, `project-images/${id}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'projects', id), { imageUrl });
        alert('Visual updated!');
    } catch (err) {
        alert('Failed.');
    } finally {
        setUploading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'none' | 'verified' | 'rejected') => {
      try {
          await updateDoc(doc(db, 'projects', id), { status });
      } catch (e) {
          alert('Failed to update status.');
      }
  };

  const handleResetData = async () => {
    const confirmation = window.prompt(t[lang].purge_prompt);
    if (confirmation !== 'RESET') return;
    setUploading(true);
    try {
        const batch = writeBatch(db);
        results.forEach(r => { batch.update(doc(db, 'results', r.id), { votes: 0 }); });
        batch.set(doc(db, 'stats', 'global'), { total: 0 });
        
        const votersSnap = await getDocs(collection(db, 'voters'));
        votersSnap.forEach((voterDoc) => { batch.delete(voterDoc.ref); });

        const ipsSnap = await getDocs(collection(db, 'ips'));
        ipsSnap.forEach((ipDoc) => { batch.delete(ipDoc.ref); });

        await batch.commit();
        localStorage.removeItem('htu_badge_shown');
        localStorage.removeItem('htu_voter_data');
        alert('Votes and device/network limits purged. Local certificate limit reset.');
    } catch (e: any) {
        alert(`Failed: ${e.message}`);
    } finally {
        setUploading(false);
    }
  };

  const handleHardReset = async () => {
      const confirmation = window.prompt(t[lang].hard_reset_prompt);
      if (confirmation !== 'HARD RESET') return;

      setUploading(true);
      try {
          const projectsSnap = await getDocs(collection(db, 'projects'));
          const resultsSnap = await getDocs(collection(db, 'results'));
          const gallerySnap = await getDocs(collection(db, 'gallery'));
          const votersSnap = await getDocs(collection(db, 'voters'));
          const ipsSnap = await getDocs(collection(db, 'ips'));

          const batch = writeBatch(db);
          projectsSnap.forEach(d => batch.delete(d.ref));
          resultsSnap.forEach(d => batch.delete(d.ref));
          gallerySnap.forEach(d => batch.delete(d.ref));
          votersSnap.forEach(d => batch.delete(d.ref));
          ipsSnap.forEach(d => batch.delete(d.ref));
          batch.set(doc(db, 'stats', 'global'), { total: 0 });
          batch.update(doc(db, 'config', 'voting'), { archiveMode: false });

          await batch.commit();
          localStorage.removeItem('htu_badge_shown');
          localStorage.removeItem('htu_voter_data');
          alert('SYSTEM WIPE COMPLETE. ALL DATA DELETED. Local limits reset.');
      } catch (e: any) {
          alert(`Hard Reset Failed: ${e.message}`);
      } finally {
          setUploading(false);
      }
  };

  const handleUploadGalleryImage = async () => {
      if (!selectedGalleryImages || selectedGalleryImages.length === 0) return;
      setUploadingGallery(true);
      let successCount = 0;
      let errorMsgs: string[] = [];
      try {
          const uploadPromises = Array.from(selectedGalleryImages).map(async (file) => {
              try {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('upload_preset', 'htu_expo_gallery');
                  const response = await fetch('https://api.cloudinary.com/v1_1/dohnbi42z/image/upload', { method: 'POST', body: formData });
                  if (!response.ok) { const errText = await response.text(); throw new Error(`Error: ${errText}`); }
                  const data = await response.json();
                  if (data.secure_url) {
                      const galleryRef = doc(collection(db, 'gallery'));
                      await setDoc(galleryRef, { imageUrl: data.secure_url, timestamp: Date.now() + Math.random() });
                      successCount++;
                  }
              } catch (innerErr: any) { errorMsgs.push(innerErr.message || "Unknown error"); }
          });
          await Promise.all(uploadPromises);
          if (successCount > 0) { setSelectedGalleryImages(null); }
      } catch (err: any) { alert(`Error: ${err.message}`); } finally { setUploadingGallery(false); }
  };

  const handleDeleteGalleryImage = async (id: string) => {
      if (window.confirm('Delete photo?')) {
          try {
              const batch = writeBatch(db);
              batch.delete(doc(db, 'gallery', id));
              await batch.commit();
          } catch(e) { alert('Permission denied.'); }
      }
  };

  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (selectedPlacard && qrRef.current) {
          qrRef.current.innerHTML = ''; // Clear previous
          const qrCode = new QRCodeStyling({
              width: 450,
              height: 450,
              data: `${window.location.origin}${window.location.pathname}?project=${selectedPlacard.id}`,
              image: `${window.location.origin}${import.meta.env.BASE_URL}htu-logo.png`,
              dotsOptions: {
                  color: "#E8343F",
                  type: "rounded"
              },
              cornersSquareOptions: {
                  type: "extra-rounded",
                  color: "#01060D"
              },
              cornersDotOptions: {
                  type: "dot",
                  color: "#E8343F"
              },
              backgroundOptions: {
                  color: "transparent",
              },
              imageOptions: {
                  crossOrigin: "anonymous",
                  margin: 20
              }
          });
          qrCode.append(qrRef.current);
      }
  }, [selectedPlacard]);

  const downloadPlacardNative = async () => {
    if (!selectedPlacard) return;
    
    // Create the QR Code blob natively
    const qrCode = new QRCodeStyling({
        width: 500,
        height: 500,
        data: `${window.location.origin}${window.location.pathname}?project=${selectedPlacard.id}`,
        image: `${window.location.origin}${import.meta.env.BASE_URL}htu-logo.png`,
        dotsOptions: { color: "#E8343F", type: "rounded" },
        cornersSquareOptions: { type: "extra-rounded", color: "#01060D" },
        cornersDotOptions: { type: "dot", color: "#E8343F" },
        backgroundOptions: { color: "#FFFFFF" },
        imageOptions: { crossOrigin: "anonymous", margin: 20 }
    });

    const qrBlob = await qrCode.getRawData("png");
    if (!qrBlob) return;

    const qrImage = new Image();
    qrImage.src = URL.createObjectURL(qrBlob);
    await new Promise((res) => { qrImage.onload = res; qrImage.onerror = res; });

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1080, 1920);

    // Border
    ctx.strokeStyle = '#E8343F';
    ctx.lineWidth = 20;
    ctx.strokeRect(40, 40, 1000, 1840);

    // Header Logo
    try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `${window.location.origin}${import.meta.env.BASE_URL}htu-logo.png`;
        await new Promise((res) => { img.onload = res; img.onerror = res; });
        ctx.drawImage(img, 1080 / 2 - 100, 120, 200, 200);
    } catch(e) {}

    // Expo Badge
    ctx.fillStyle = '#01060D';
    ctx.font = 'bold 35px Montserrat, Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HTU ENGINEERING DESIGN EXPO 2026', 1080 / 2, 380);

    // Title, Meta & Wrap Logic
    const wrapText = (text: string, y: number, maxWidth: number, lineHeight: number) => {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                ctx.fillText(line.trim(), 1080 / 2, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), 1080 / 2, currentY);
        return currentY + lineHeight;
    };

    // Clean up team members string for better wrapping (add space after commas)
    const safeTeamMembers = selectedPlacard.team_members.replace(/,/g, ', ').replace(/\s+/g, ' ').trim();

    // 1. Draw Title
    ctx.fillStyle = '#E8343F';
    ctx.font = '900 70px Montserrat, Tajawal, sans-serif';
    let currentY = wrapText(selectedPlacard.title.toUpperCase(), 520, 900, 80);

    // 2. Draw Team Members
    currentY += 20;
    ctx.fillStyle = '#222';
    ctx.font = '700 45px Montserrat, Tajawal, sans-serif';
    currentY = wrapText(safeTeamMembers, currentY, 900, 60);
    
    // 3. Draw Instructor
    currentY += 10;
    ctx.fillStyle = '#555';
    ctx.font = '600 35px Montserrat, Tajawal, sans-serif';
    currentY = wrapText(`Instructor: ${selectedPlacard.instructor}`, currentY, 900, 45);

    // 4. Draw QR Code (Dynamic Y-Position based on text block height)
    const qrStartY = Math.max(currentY + 50, 750); // Ensure minimal spacing, but keep it balanced
    ctx.drawImage(qrImage, 1080 / 2 - 250, qrStartY, 500, 500);

    // 5. Draw Scan Prompt
    ctx.fillStyle = '#01060D';
    ctx.font = '900 50px Montserrat, Tajawal, sans-serif';
    ctx.fillText('SCAN TO VOTE FOR THIS TEAM', 1080 / 2, qrStartY + 580);


    const link = document.createElement('a');
    link.download = `HTU_Placard_${selectedPlacard.title.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const filteredAndSortedTeams = projects
    .filter(p => {
        const s = teamSearchTerm.toLowerCase().trim();
        if (!s) return true;
        const title = (p.title || '').toLowerCase();
        const instructor = (p.instructor || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const members = (p.team_members || '').toLowerCase();
        return title.includes(s) || instructor.includes(s) || id.includes(s) || members.includes(s);
    })
    .sort((a, b) => {
        if (teamSortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        if (teamSortBy === 'instructor') return (a.instructor || '').localeCompare(b.instructor || '');
        if (teamSortBy === 'section') return (a.section_number || '').localeCompare(b.section_number || '');
        if (teamSortBy === 'status') {
            const statusOrder = { 'verified': 0, 'none': 1, 'rejected': 2 };
            return (statusOrder[a.status || 'none'] || 0) - (statusOrder[b.status || 'none'] || 0);
        }
        return 0;
    });

  if (!user || !role) {
    return (
      <div className="admin-login-container" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="background-wrapper"><div className="bg-grid" /><div className="bg-mesh" /></div>
        <button className="back-to-site-inline" onClick={() => { auth.signOut(); onBack(); }}><ArrowLeft size={18} className={lang === 'ar' ? 'rotate-180' : ''} /> {t[lang].back}</button>
        <motion.div className="glass-card login-portal-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="login-header-elite">
            <div className="security-icon-wrapper"><ShieldCheck size={60} color="#E8343F" className="pulsing-icon" /></div>
            <h2>{t[lang].login_title}</h2>
            <p>Master / Organizer / Media Access</p>
          </div>
          <form onSubmit={handleLogin} className="elite-form">
            <div className="input-group-elite"><label>{t[lang].sys_user}</label><div className="input-wrapper"><UserCog size={20} className="field-icon" /><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required /></div></div>
            <div className="input-group-elite"><label>{t[lang].sys_pass}</label><div className="input-wrapper"><BarChart3 size={20} className="field-icon" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div></div>
            {error && <p className="error-text-elite"><AlertTriangle size={14} /> {error}</p>}
            <button type="submit" className="htu-button w-full login-btn-elite">{t[lang].init}</button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className={`admin-login-container vault-bg ${pinError ? 'emergency-lockdown' : ''}`}>
        {pinError && <div className="red-alert-overlay" />}
        <div className="background-wrapper"><div className="bg-grid" /><div className="bg-mesh" /></div>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`vault-lock-container ${pinError ? 'violent-shake-animation' : ''}`} style={{ position: 'relative' }}>
           <Lock size={48} className="vault-icon" />
           <h2>SECURE VAULT</h2>
           <p className="vault-subtitle">Enter 4-Digit Master PIN</p>
           
           <div className="pin-dots">
              {[0,1,2,3].map(i => (
                 <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''} ${pinError ? 'error-dot' : ''}`} />
              ))}
           </div>
           
           <div className="numpad-grid">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                 <button key={d} onClick={() => handlePinPress(d)} className="numpad-btn" disabled={pinError}>{d}</button>
              ))}
              <button onClick={() => { auth.signOut(); setIsLocked(true); }} className="numpad-btn action-btn" disabled={pinError}><LogOut size={24}/></button>
              <button onClick={() => handlePinPress('0')} className="numpad-btn" disabled={pinError}>0</button>
              <button onClick={handlePinDelete} className="numpad-btn action-btn" disabled={pinError}><Delete size={24}/></button>
           </div>

           <AnimatePresence>
             {funnyError && (
               <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="funny-error-msg">
                 <AlertTriangle size={16} /> {funnyError}
               </motion.div>
             )}
           </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-elite" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="background-wrapper"><div className="bg-grid" /><div className="bg-mesh" /></div>
      
      {selectedPlacard && (
          <div className="placard-overlay">
              <div id="placard-preview-node" className="placard-preview elite-placard-v2">
                  <div className="placard-header-premium">
                      <img src="/htu-logo.png" alt="HTU Logo" className="placard-htu-logo-giant" />
                      <div className="placard-expo-badge">HTU ENGINEERING DESIGN EXPO 2026</div>
                  </div>
                  
                  <div className="placard-main-info">
                      <h1 className="placard-title-v2">{selectedPlacard.title}</h1>
                      <div className="placard-meta">
                          <div className="meta-item"><Users size={24} /> <span>{selectedPlacard.team_members}</span></div>
                          <div className="meta-item"><UserCog size={24} /> <span>Instructor: {selectedPlacard.instructor}</span></div>
                      </div>
                  </div>

                  <div className="placard-qr-zone">
                      <div className="qr-box-premium" ref={qrRef}></div>
                      <div className="placard-scan-prompt">
                          <span>SCAN TO VOTE FOR THIS TEAM</span>
                      </div>
                  </div>

              </div>
              <div className="placard-controls">
                  <button className="htu-button print-action-btn" onClick={downloadPlacardNative}><Download size={20}/> Save as PNG</button>
                  <button className="htu-button outline-btn placard-close" onClick={() => setSelectedPlacard(null)}>Exit Preview</button>
              </div>
          </div>
      )}

      <nav className="admin-nav-elite">
        <div className="nav-left">
            <button className="back-btn-elite" onClick={() => { auth.signOut(); onBack(); }}><ArrowLeft size={18} className={lang === 'ar' ? 'rotate-180' : ''} /> {t[lang].back}</button>
            <div className="lang-toggle-container admin-lang-fix">
                <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
                <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>العربية</button>
            </div>
            <div className="role-badge"><div className={`status-dot ${role === 'master' ? 'master-dot' : role === 'organizer' ? 'organizer-dot' : 'media-dot'}`} /><span>{t[lang].sys} <strong>{role.toUpperCase()}</strong></span></div>
        </div>
        <div className="admin-tabs">
            {role !== 'media' && (
                <>
                    <button className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /><span>{t[lang].tab_dashboard}</span></button>
                    <button className={`admin-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}><ListChecks size={18} /><span>{t[lang].tab_teams}</span></button>
                    <button className={`admin-tab-btn ${activeTab === 'judges' ? 'active' : ''}`} onClick={() => setActiveTab('judges')}><ShieldCheck size={18} /><span>{t[lang].tab_judges}</span></button>
                    <button className={`admin-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}><ImageIcon size={18} /><span>{t[lang].tab_gallery}</span></button>
                </>
            )}
            {role === 'media' && (
                <button className={`admin-tab-btn active`} onClick={() => setActiveTab('media')}><ImageIcon size={18} /><span>{t[lang].tab_media}</span></button>
            )}
            {role === 'master' && <button className={`admin-tab-btn ${activeTab === 'stage' ? 'active' : ''}`} onClick={() => setActiveTab('stage')}><Play size={18} /><span>{t[lang].tab_stage}</span></button>}
        </div>
        <div className="nav-right">
          {role === 'master' && (
            <div className="master-controls-group">
              <button onClick={toggleVoting} className={`nav-icon-btn ${isVotingOpen ? 'btn-open' : 'btn-closed'}`}>{isVotingOpen ? <Power size={20} /> : <PowerOff size={20} />}<span>{isVotingOpen ? t[lang].voting_active : t[lang].voting_paused}</span></button>
              <button onClick={exportToExcel} className="nav-icon-btn btn-excel"><Download size={20} /><span>{t[lang].export}</span></button>
            </div>
          )}
          <button onClick={() => signOut(auth)} className="logout-btn-elite"><LogOut size={18} className={lang === 'ar' ? 'rotate-180' : ''} /> <span>{t[lang].logout}</span></button>
        </div>
      </nav>

      <main className="admin-main-elite">
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="dashboard-summary">
                <div className="glass-card stat-pill"><LayoutDashboard size={20} /><span>{t[lang].tot_projects}: <strong>{projects.length}</strong></span></div>
                {role === 'master' && (<div className="glass-card stat-pill"><Trophy size={20} color="#FFD700" /><span>{t[lang].tot_votes}: <strong>{results.reduce((acc, curr) => acc + curr.votes, 0)}</strong></span></div>)}
            </div>
            <div className="dashboard-layout">
              <section className="dashboard-column">
                  <div className="glass-card elite-admin-card">
                    <div className="card-header-elite"><h3><Plus size={22} /> {t[lang].add_title}</h3></div>
                    <form onSubmit={handleAddProject} className="elite-add-form">
                      <div className="form-group-elite"><input placeholder={t[lang].p_title} value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} required /></div>
                      <div className="form-row-elite">
                          <input placeholder={t[lang].p_inst} value={newProject.instructor} onChange={e => setNewProject({...newProject, instructor: e.target.value})} required />
                          <input placeholder={t[lang].p_team} value={newProject.team_members} onChange={e => setNewProject({...newProject, team_members: e.target.value})} required />
                      </div>
                      <div className="form-row-elite"><input placeholder={t[lang].p_section} value={newProject.section_number} onChange={e => setNewProject({...newProject, section_number: e.target.value})} /></div>
                      <div className="file-upload-elite"><label className="file-label-elite">{selectedImage ? <ImageIcon size={22} color="#E8343F" /> : <Upload size={22} />}<span>{selectedImage ? selectedImage.name : t[lang].attach}</span><input type="file" accept="image/*" onChange={e => setSelectedImage(e.target.files?.[0] || null)} className="hidden-file-input" /></label></div>
                      <button type="submit" className="htu-button submit-project-btn w-full" disabled={uploading}>{uploading ? <Loader2 className="animate-spin" size={20} /> : t[lang].deploy}</button>
                    </form>
                  </div>
              </section>
              {role === 'master' && (
                <section className="dashboard-column">
                  <div className="glass-card elite-admin-card leaderboard-column">
                    <div className="card-header-elite"><h3><Trophy size={22} color="#FFD700" /> {t[lang].top_ranked}</h3></div>
                    <div className="elite-leaderboard">
                        <AnimatePresence>
                          {results.slice(0, 8).map((p, i) => (
                          <motion.div key={p.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }} className="elite-leaderboard-item"><span className={`rank-badge rank-${i + 1}`}>{i + 1}</span><div className="item-info"><p className="title">{p.title}</p><p className="dept">{p.instructor}</p></div><div className="item-stats"><strong>{p.votes}</strong><span>{t[lang].votes_txt}</span></div></motion.div>
                          ))}
                        </AnimatePresence>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {role === 'master' && (
                <section className="security-dashboard">
                    <div className="security-header"><Activity size={24} /> {t[lang].security_title}</div>
                    <div className="security-grid">
                        {Object.entries(velocityMap).map(([id, velocity]) => {
                            const p = projects.find(proj => proj.id === id);
                            if (!p) return null;
                            const isHigh = velocity > 3;
                            return (
                                <div key={id} className={`security-card ${isHigh ? 'flagged' : ''}`}>
                                    <div className="sec-team">
                                        {p.title}
                                        <span>ID: {p.id}</span>
                                    </div>
                                    <div className={`sec-velocity ${isHigh ? 'high' : ''}`}>+{velocity} / 15s</div>
                                </div>
                            )
                        })}
                        {Object.keys(velocityMap).length === 0 && <div style={{ color: 'rgba(255,255,255,0.4)' }}>No significant voting velocity detected.</div>}
                    </div>
                </section>
            )}

            {role === 'master' && (
              <>
                <section className="danger-zone-elite">
                    <div className="danger-content"><AlertTriangle size={30} /><div className="text"><h3>{t[lang].critical}</h3><p>{t[lang].critical_desc}</p></div></div>
                    <button onClick={handleResetData} className="htu-button reset-btn-elite" disabled={uploading}>{uploading ? <Loader2 className="animate-spin" size={20} /> : t[lang].purge}</button>
                </section>
                <section className="danger-zone-elite hard-reset-section" style={{ borderStyle: 'dashed', borderColor: '#ff0000' }}>
                    <div className="danger-content"><Bomb size={30} /><div className="text"><h3>{t[lang].hard_reset}</h3><p>{t[lang].hard_reset_desc}</p></div></div>
                    <button onClick={handleHardReset} className="htu-button reset-btn-elite" disabled={uploading} style={{ background: '#000' }}>{uploading ? <Loader2 className="animate-spin" size={20} /> : t[lang].hard_reset_btn}</button>
                </section>
                <section className={`danger-zone-elite archive-section ${archiveMode ? 'archive-active' : ''}`}>
                    <div className="danger-content">
                        <Printer size={30} className={archiveMode ? "pulsing-icon" : ""} color={archiveMode ? "#FFD700" : "white"} />
                        <div className="text">
                            <h3>{t[lang].archive_mode}</h3>
                            <p>{t[lang].archive_desc}</p>
                        </div>
                    </div>
                    <button onClick={handleArchiveMode} className={`htu-button ${archiveMode ? 'active-archive-btn' : 'archive-btn'}`} disabled={uploading}>
                        {uploading ? <Loader2 className="animate-spin" size={20} /> : (archiveMode ? "Deactivate Archive" : t[lang].archive_btn)}
                    </button>
                </section>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'teams' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="glass-card elite-admin-card">
                  <div className="card-header-elite">
                      <div className="teams-header-flex">
                          <h3><Users size={22} /> {t[lang].tab_teams}</h3>
                          <div className="teams-controls-grid">
                              <div className="input-wrapper teams-search-wrapper"><Search size={18} className="field-icon" /><input type="text" placeholder={t[lang].search_teams} value={teamSearchTerm} onChange={(e) => setTeamSearchTerm(e.target.value)} className="teams-search-input" /></div>
                              <div className="sort-wrapper"><Filter size={18} className="field-icon" /><select value={teamSortBy} onChange={(e) => setTeamSortBy(e.target.value as any)} className="teams-sort-select"><option value="title">{t[lang].sort_title}</option><option value="instructor">{t[lang].sort_instructor}</option><option value="section">{t[lang].sort_section}</option><option value="status">{t[lang].sort_status}</option></select></div>
                          </div>
                      </div>
                  </div>
                  <div className="elite-table-wrapper">
                      <table className="elite-table">
                          <thead><tr><th>{t[lang].p_title}</th><th>{t[lang].p_inst}</th><th>{t[lang].th_members}</th><th>{t[lang].th_section}</th><th>{t[lang].th_team_id}</th><th className="text-right">Attendance</th><th className="text-right">{t[lang].th_verify}</th></tr></thead>
                          <tbody>
                              {filteredAndSortedTeams.map(p => (
                                  <tr key={p.id} className={`status-row-${p.status || 'none'}`}>
                                      <td>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              {p.imageUrl && <img src={p.imageUrl} alt="P" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />}
                                              <strong>{p.title}</strong>
                                          </div>
                                      </td>
                                      <td><span className="table-dept-tag">{p.instructor}</span></td>
                                      <td><div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{p.team_members}</div></td>
                                      <td><span className="badge-title-pill" style={{ fontSize: '0.7rem', padding: '4px 12px' }}>{p.section_number || '-'}</span></td>
                                      <td>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <code style={{ fontSize: '0.7rem', opacity: 0.5 }}>{p.id}</code>
                                            <button onClick={() => setSelectedPlacard(p)} className="print-btn"><Printer size={12}/> {t[lang].print_placard}</button>
                                          </div>
                                      </td>
                                      <td className="text-right">
                                          {/* Attendance Button */}
                                          {(() => {
                                            const members = (p.team_members || '').split(',').map(m => m.trim()).filter(Boolean);
                                            const status = getAttendanceStatus(p.id, members);
                                            return (
                                              <button
                                                onClick={() => setAttendancePopout(attendancePopout === p.id ? null : p.id)}
                                                className={`attendance-btn attendance-${status}`}
                                                title="Take Attendance"
                                              >
                                                <ClipboardCheck size={14} />
                                                <span>Attendance</span>
                                              </button>
                                            );
                                          })()}
                                      </td>
                                      <td className="text-right">
                                              <div className="admin-project-actions">
                                                <button onClick={() => handleUpdateStatus(p.id, 'verified')} className={`verify-btn ${p.status === 'verified' ? 'active' : ''}`} title="Verify"><ShieldCheck size={16} /></button>
                                                <button onClick={() => handleUpdateStatus(p.id, 'rejected')} className={`reject-btn ${p.status === 'rejected' ? 'active' : ''}`} title="Reject"><X size={16} /></button>
                                                <button onClick={() => handleUpdateStatus(p.id, 'none')} className="reset-status-btn" title="Reset Status"><RotateCcw size={14} /></button>
                                                <label className="action-pill-btn photo-upload-pill">
                                                    <Upload size={14} />
                                                    <span>{t[lang].update}</span>
                                                    <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpdateImage(p.id, f); }} className="hidden-file-input" />
                                                </label>
                                                {role === 'master' && (
                                                    <button onClick={() => handleDeleteProject(p.id)} className="elite-delete-btn" title="Delete Project"><Trash2 size={18} /></button>
                                                )}
                                              </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          {/* Attendance Popout Modal */}
          <AnimatePresence>
            {attendancePopout && (() => {
              const project = projects.find(p => p.id === attendancePopout);
              if (!project) return null;
              const members = (project.team_members || '').split(',').map(m => m.trim()).filter(Boolean);
              const a = attendance[attendancePopout] || {};
              const checkedCount = members.filter(m => a[m]).length;
              const status = checkedCount === 0 ? 'none' : checkedCount === members.length ? 'full' : 'partial';
              return (
                <motion.div
                  key="attendance-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="attendance-modal-overlay"
                  onClick={() => setAttendancePopout(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 30 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 30 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="attendance-modal-card"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="attendance-modal-header">
                      <div>
                        <h3 className="attendance-modal-title"><ClipboardCheck size={20} /> Attendance</h3>
                        <p className="attendance-modal-subtitle">{project.title}</p>
                      </div>
                      <div className={`attendance-status-badge attendance-badge-${status}`}>
                        {checkedCount}/{members.length} Present
                      </div>
                    </div>

                    <div className="attendance-member-list">
                      {members.length === 0 ? (
                        <p style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>No team members listed.</p>
                      ) : members.map((member, i) => (
                        <label key={i} className={`attendance-member-row ${a[member] ? 'member-present' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!a[member]}
                            onChange={e => toggleAttendance(attendancePopout, member, e.target.checked)}
                            className="attendance-checkbox"
                          />
                          <span className="attendance-member-name">{member}</span>
                          <span className={`attendance-dot ${a[member] ? 'dot-present' : 'dot-absent'}`} />
                        </label>
                      ))}
                    </div>

                    <div className="attendance-modal-footer">
                      <button onClick={() => setAllAttendance(attendancePopout, members, true)}
                        className="attendance-action-btn btn-mark-all">✓ Mark All Present</button>
                      <button onClick={() => setAllAttendance(attendancePopout, members, false)}
                        className="attendance-action-btn btn-clear-all">✕ Clear All</button>
                      <button onClick={() => setAttendancePopout(null)} className="attendance-action-btn btn-close-modal">Close</button>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
      </motion.div>
        )}

        {activeTab === 'stage' && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="glass-card elite-admin-card stage-controls-card">
                    <div className="card-header-elite"><h3><Play size={22} color="#E8343F" /> {t[lang].stage_title}</h3><p style={{ opacity: 0.6 }}>{t[lang].stage_desc}</p></div>
                    
                    <div className="stage-controls-grid">
                        <div className="stage-control-item glass-card">
                            <div className="item-label"><Eye size={20} /> <span>Security Masking</span></div>
                            <button onClick={() => updateKiosk({ hideResults: !kioskConfig.hideResults })} className={`stage-btn ${kioskConfig.hideResults ? 'btn-danger' : 'btn-success'}`}>
                                {kioskConfig.hideResults ? <EyeOff size={20} /> : <Eye size={20} />}
                                <span>{kioskConfig.hideResults ? t[lang].show_results : t[lang].hide_results}</span>
                            </button>
                        </div>

                        <div className="stage-control-item glass-card">
                            <div className="item-label"><Repeat size={20} /> <span>Dynamic Rotation</span></div>
                            <button onClick={() => updateKiosk({ autoRotate: !kioskConfig.autoRotate })} className={`stage-btn ${kioskConfig.autoRotate ? 'btn-active-glow' : ''}`}>
                                {kioskConfig.autoRotate ? t[lang].auto_rotate_on : t[lang].auto_rotate_off}
                            </button>
                        </div>
                        
                        <div className="stage-control-item glass-card" style={{ gridColumn: 'span 2' }}>
                            <div className="item-label"><Megaphone size={20} /> <span>{t[lang].ticker_label}</span></div>
                            <div className="ticker-input-wrapper">
                                <input type="text" placeholder={t[lang].ticker_placeholder} value={kioskConfig.tickerText} onChange={(e) => updateKiosk({ tickerText: e.target.value })} className="ticker-admin-input" />
                                {kioskConfig.tickerText && <button onClick={() => updateKiosk({ tickerText: "" })} className="ticker-clear"><X size={16}/></button>}
                            </div>
                        </div>

                        <div className="stage-control-item glass-card" style={{ gridColumn: 'span 2' }}>
                            <div className="item-label"><Users size={20} /> <span>{t[lang].head_org_names_label}</span></div>
                            <div className="ticker-input-wrapper"><input type="text" placeholder={t[lang].org_names_placeholder} value={kioskConfig.headOrganizerNames || ""} onChange={(e) => updateKiosk({ headOrganizerNames: e.target.value })} className="ticker-admin-input" /></div>

                            <div className="item-label" style={{ marginTop: '15px' }}><Users size={20} /> <span>{t[lang].inst_extra_label}</span></div>
                            <div className="ticker-input-wrapper"><input type="text" placeholder={t[lang].org_names_placeholder} value={kioskConfig.instructorNamesExtra || ""} onChange={(e) => updateKiosk({ instructorNamesExtra: e.target.value })} className="ticker-admin-input" /></div>
                            <div className="item-label" style={{ marginTop: '15px' }}><Users size={20} /> <span>{t[lang].vol_names_label}</span></div>
                            <div className="ticker-input-wrapper"><input type="text" placeholder={t[lang].org_names_placeholder} value={kioskConfig.volunteerNames || ""} onChange={(e) => updateKiosk({ volunteerNames: e.target.value })} className="ticker-admin-input" /></div>
                        </div>

                        <div className="stage-control-item glass-card" style={{ gridColumn: 'span 2' }}>
                            <div className="item-label"><Trophy size={20} color="#FFD700" /> <span>Hall of Fame & Ceremony Selection</span></div>
                            <div className="ceremony-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
                                {[0, 1, 2, 3, 4].map(idx => (
                                    <div key={idx}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '5px', display: 'block' }}>
                                            {idx === 0 ? '1st Place (Champion)' : idx === 1 ? '2nd Place' : idx === 2 ? '3rd Place' : idx === 3 ? '4th Place' : 'Fan Favorite'}
                                        </label>
                                        <select
                                            value={(kioskConfig.hofSelection || [])[idx] || ""}
                                            onChange={(e) => {
                                                const current = [...(kioskConfig.hofSelection || ['', '', '', '', ''])];
                                                current[idx] = e.target.value;
                                                const cleanHof = [0, 1, 2, 3, 4].map(i => current[i] || '');
                                                updateKiosk({ hofSelection: cleanHof, ceremonySelection: cleanHof });
                                                // Sync to voting config as well for the public display
                                                setDoc(doc(db, 'config', 'voting'), { hofSelection: cleanHof }, { merge: true }).catch(err => alert("Failed to save selection: " + err.message));
                                            }}
                                            className="ticker-admin-input"
                                            style={{ fontSize: '0.8rem', padding: '12px' }}
                                        >
                                            <option value="">-- Select --</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="stage-control-item glass-card" style={{ gridColumn: 'span 2' }}>        
                            <div className="item-label"><Trophy size={20} color="#FFD700" /> <span>Victory Reveal Mode</span></div>
                            <button onClick={() => updateKiosk({ victoryMode: !kioskConfig.victoryMode, revealStep: 0, isPaused: true })} className={`stage-btn ${kioskConfig.victoryMode ? 'btn-active-glow' : ''} w-full`}>   
                                {kioskConfig.victoryMode ? <X size={20} /> : <Play size={20} />}
                                <span>{kioskConfig.victoryMode ? t[lang].victory_stop : t[lang].victory_start}</span>
                            </button>
                        </div>
                        </div>

                        {kioskConfig.victoryMode && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="ceremony-orchestrator glass-card mt-8">
                            <div className="ceremony-status" style={{ marginBottom: '20px' }}>
                                <span className="status-label">Live Scene:</span>
                                <strong className="phase-name">{t[lang][`ceremony_step_${kioskConfig.revealStep}` as keyof typeof t['ar']] as string}</strong>
                            </div>

                            <div className="scene-selector-grid">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(step => (
                                    <button key={step} onClick={() => updateKiosk({ revealStep: step, isPaused: false })} className={`scene-btn ${kioskConfig.revealStep === step ? 'active' : ''}`}>
                                        <div className="scene-number">{step}</div>
                                        <div className="scene-name">{t[lang][`ceremony_step_${step}` as keyof typeof t['ar']] as string}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="ceremony-actions" style={{ marginTop: '20px' }}>
                                <button className="stage-icon-btn" onClick={() => updateKiosk({ revealStep: Math.max(0, kioskConfig.revealStep - 1), isPaused: false })}><Rewind size={24} /></button>
                                <button className="stage-icon-btn" onClick={() => updateKiosk({ revealStep: Math.min(14, kioskConfig.revealStep + 1), isPaused: false })}><SkipForward size={24} /></button>
                                <button className="stage-reset-btn" onClick={() => updateKiosk({ revealStep: 0, isPaused: true })}><RotateCcw size={20} /> <span>{t[lang].reveal_reset}</span></button>
                            </div>
                        </motion.div>
                        )}
                </div>
            </motion.div>
        )}

        {activeTab === 'judges' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="dashboard-layout">
              {/* Registration Form */}
              <section className="dashboard-column">
                <div className="glass-card elite-admin-card">
                  <div className="card-header-elite"><h3><Plus size={22} /> {t[lang].judge_title}</h3></div>
                  <form onSubmit={handleAddJudge} className="elite-add-form">
                    <div className="form-group-elite">
                      <input placeholder={t[lang].judge_name} value={newJudge.name} onChange={e => setNewJudge({ ...newJudge, name: e.target.value })} required />
                    </div>
                    <div className="form-row-elite">
                      <input placeholder={t[lang].judge_job_title} value={newJudge.title} onChange={e => setNewJudge({ ...newJudge, title: e.target.value })} />
                      <input placeholder={t[lang].judge_dept} value={newJudge.department} onChange={e => setNewJudge({ ...newJudge, department: e.target.value })} />
                    </div>
                    <div className="form-group-elite">
                      <input type="email" placeholder={t[lang].judge_email} value={newJudge.email} onChange={e => setNewJudge({ ...newJudge, email: e.target.value })} />
                    </div>
                    <button type="submit" className="htu-button" disabled={addingJudge}>
                      {addingJudge ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={18} /> {t[lang].judge_register}</>}
                    </button>
                  </form>
                </div>
              </section>

              {/* Judge List */}
              <section className="dashboard-column" style={{ flex: 2 }}>
                <div className="glass-card elite-admin-card table-section-elite">
                  <div className="card-header-elite" style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <h3><ShieldCheck size={22} /> {t[lang].judge_count}: <strong>{judges.length}</strong></h3>
                    <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                      <input
                        placeholder={t[lang].judge_search}
                        value={judgeSearch}
                        onChange={e => setJudgeSearch(e.target.value)}
                        className="search-input-elite"
                        style={{ minWidth: '220px' }}
                      />
                      <button className="htu-button outline-btn" onClick={exportJudgesCSV} title="Export CSV">
                        <Download size={16} /> CSV
                      </button>
                    </div>
                  </div>
                  <div className="elite-table-wrapper">
                    <table className="elite-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t[lang].judge_th_name}</th>
                          <th>{t[lang].judge_th_title}</th>
                          <th>{t[lang].judge_th_dept}</th>
                          <th>{t[lang].judge_th_email}</th>
                          <th>{t[lang].judge_th_date}</th>
                          <th>{t[lang].th_ops}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {judges
                          .filter(j => {
                            const s = judgeSearch.toLowerCase();
                            return !s || j.name.toLowerCase().includes(s) || j.department.toLowerCase().includes(s) || j.email.toLowerCase().includes(s);
                          })
                          .map((j, idx) => (
                            <tr key={j.id}>
                              <td><span className="section-badge">{idx + 1}</span></td>
                              <td><strong>{j.name}</strong></td>
                              <td>{j.title || '—'}</td>
                              <td>{j.department || '—'}</td>
                              <td style={{ fontSize: '0.85rem', opacity: 0.8 }}>{j.email || '—'}</td>
                              <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{j.registeredAt ? new Date(j.registeredAt).toLocaleDateString() : '—'}</td>
                              <td>
                                <button className="action-btn-danger" onClick={() => handleDeleteJudge(j.id)}>
                                  <Trash2 size={14} /> {t[lang].judge_delete}
                                </button>
                              </td>
                            </tr>
                          ))}
                        {judges.length === 0 && (
                          <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: '30px' }}>{t[lang].judge_empty}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'gallery' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <section className="glass-card elite-admin-card table-section-elite">
              <div className="card-header-elite"><h3><ImageIcon size={22} /> {t[lang].gallery_mgmt}</h3></div>
              <div className="file-upload-elite"><label className="file-label-elite">{selectedGalleryImages && selectedGalleryImages.length > 0 ? <ImageIcon size={22} color="#E8343F" /> : <Upload size={22} />}<span>{selectedGalleryImages && selectedGalleryImages.length > 0 ? `${selectedGalleryImages.length} files` : t[lang].upload_gallery}</span><input type="file" accept="image/*" multiple onChange={e => setSelectedGalleryImages(e.target.files)} className="hidden-file-input" /></label><button className="htu-button" onClick={handleUploadGalleryImage} disabled={!selectedGalleryImages || uploadingGallery} style={{ marginLeft: lang === 'ar' ? '0' : '15px', marginRight: lang === 'ar' ? '15px' : '0' }}>{uploadingGallery ? <Loader2 className="animate-spin" size={20} /> : t[lang].upload_gallery}</button></div>
              <div className="elite-table-wrapper">
                <table className="elite-table">
                    <thead><tr><th>{t[lang].th_visual}</th><th>ID</th><th className="text-right">{t[lang].th_ops}</th></tr></thead>
                    <tbody>
                        {galleryImages.map(g => (
                        <tr key={g.id}><td><div className="table-thumb-container" style={{ width: '100px', height: '60px' }}><img src={g.imageUrl} alt="G" className="table-thumbnail" /></div></td><td><span className="table-dept-tag" style={{ fontFamily: 'monospace' }}>{g.id}</span></td><td className="text-right"><button onClick={() => handleDeleteGalleryImage(g.id)} className="elite-delete-btn"><Trash2 size={18} /> {t[lang].delete}</button></td></tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'media' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="media-portal-container">
                <div className="glass-card elite-admin-card" style={{ textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
                    <div className="card-header-elite" style={{ justifyContent: 'center', border: 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                            <div className="security-icon-wrapper" style={{ margin: 0 }}><ImageIcon size={40} color="#E8343F" className="pulsing-icon" /></div>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 1000 }}>{t[lang].media_title}</h2>
                            <p style={{ opacity: 0.6, fontSize: '1.1rem', letterSpacing: '1px' }}>{t[lang].media_desc}</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '50px' }}>
                        <label className="file-label-elite" style={{ padding: '80px 40px', border: '3px dashed rgba(232, 52, 63, 0.3)', borderRadius: '40px', background: 'rgba(232, 52, 63, 0.03)', transition: '0.5s' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                                <Upload size={60} color="#E8343F" />
                                <span style={{ fontSize: '1.4rem', color: '#fff' }}>{t[lang].drop_images}</span>
                                {selectedGalleryImages && selectedGalleryImages.length > 0 && (
                                    <div style={{ background: '#10b981', color: '#fff', padding: '10px 25px', borderRadius: '50px', fontWeight: 900 }}>
                                        {selectedGalleryImages.length} {t[lang].files_selected}
                                    </div>
                                )}
                            </div>
                            <input type="file" accept="image/*" multiple onChange={e => setSelectedGalleryImages(e.target.files)} className="hidden-file-input" />
                        </label>

                        <button 
                            className="htu-button w-full" 
                            style={{ marginTop: '30px', padding: '30px', fontSize: '1.5rem', borderRadius: '24px', letterSpacing: '4px' }}
                            onClick={handleUploadGalleryImage} 
                            disabled={!selectedGalleryImages || uploadingGallery}
                        >
                            {uploadingGallery ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                    <Loader2 className="animate-spin" size={30} />
                                    <span>BEAMING...</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                    <Megaphone size={30} />
                                    <span>{t[lang].upload_to_cloud}</span>
                                </div>
                            )}
                        </button>
                    </div>

                    <div style={{ marginTop: '80px', textAlign: 'left' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '30px', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>
                            {t[lang].recent_uploads}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                            <AnimatePresence>
                                {galleryImages.slice(0, 10).map((img, i) => (
                                    <motion.div 
                                        key={img.id} 
                                        initial={{ opacity: 0, scale: 0.8 }} 
                                        animate={{ opacity: 1, scale: 1 }} 
                                        transition={{ delay: i * 0.1 }}
                                        style={{ aspectRatio: '1', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
                                    >
                                        <img src={img.imageUrl} alt="Recent" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button 
                                            onClick={() => handleDeleteGalleryImage(img.id)}
                                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </main>
      <footer className="admin-footer-elite"><p>&copy; 2026 Al-Hussein Technical University.</p><p className="credits">{t[lang].footer_text}</p></footer>
    </div>
  );
}