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
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getDocs,
  updateDoc
} from './firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Plus, Trash2, Trophy, Users, ShieldCheck, UserCog, Upload, Image as ImageIcon, Loader2, Download, Power, PowerOff, ArrowLeft, BarChart3, LayoutDashboard, AlertTriangle, ListChecks, CheckCircle2, X, RotateCcw, Search, Filter, Bomb, Eye, EyeOff, Play, Pause, SkipForward, Rewind, Megaphone, Repeat, Printer, Activity, Volume2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

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

interface AdminPanelProps {
    onBack: () => void;
    lang: 'en' | 'ar';
    setLang: (l: 'en' | 'ar') => void;
}

export default function AdminPanel({ onBack, lang, setLang }: AdminPanelProps) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'master' | 'organizer' | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'teams' | 'gallery' | 'stage'>('dashboard');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [archiveMode, setArchiveMode] = useState(false);
  
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
      audioStatus: 'playing' | 'stopped';
      activeAudio: string;
  }>({
      hideResults: false,
      victoryMode: false,
      revealStep: 0,
      isPaused: true,
      autoRotate: false,
      tickerText: "",
      organizerNames: "",
      headOrganizerNames: "",
      audioStatus: 'stopped',
      activeAudio: 'none'
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
      tab_gallery: "Gallery",
      tab_stage: "Stage Control",
      th_members: "Team Members",
      th_section: "Section",
      th_team_id: "Team ID",
      th_verify: "Verification",
      search_teams: "Search by team, instructor, or ID...",
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
      ceremony_step_0: "Atmospheric Countdown",
      ceremony_step_1: "Special Thanks - Uni",
      ceremony_step_2: "Special Thanks - Presidency",
      ceremony_step_3: "Special Thanks - Instructors",
      ceremony_step_4: "Special Thanks - Organizers",
      ceremony_step_5: "Organizers Roll Call",
      ceremony_step_6: "Reveal 3rd Place",
      ceremony_step_7: "Reveal 2nd Place",
      ceremony_step_8: "THE GRAND CHAMPION",
      auto_rotate_on: "Auto-Rotate Active",
      auto_rotate_off: "Static Display",
      ticker_label: "Live News Ticker Announcement",
      ticker_placeholder: "Type a public announcement...",
      head_org_names_label: "Head Organizers (e.g. John, Jane)",
      org_names_label: "Organizers Names (Comma separated)",
      org_names_placeholder: "John Doe, Jane Doe, etc...",
      print_placard: "Print",
      security_title: "Anti-Bot & Velocity Dashboard",
      audio_soundboard: "Kiosk Audio Soundboard"
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
      tab_gallery: "المعرض",
      tab_stage: "التحكم بالمسرح",
      th_members: "أعضاء الفريق",
      th_section: "الشعبة",
      th_team_id: "ID الفريق",
      th_verify: "التحقق",
      search_teams: "البحث عن فريق، مشرف، أو ID...",
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
      ceremony_step_0: "العد التنازلي التفاعلي",
      ceremony_step_1: "شكر خاص - الجامعة",
      ceremony_step_2: "شكر خاص - الرئاسة",
      ceremony_step_3: "شكر خاص - المشرفين",
      ceremony_step_4: "شكر خاص - المنظمين",
      ceremony_step_5: "أسماء فريق التنظيم",
      ceremony_step_6: "كشف المركز الثالث",
      ceremony_step_7: "كشف المركز الثاني",
      ceremony_step_8: "إعلان البطل الأول",
      auto_rotate_on: "التدوير التلقائي مفعّل",
      auto_rotate_off: "عرض ثابت",
      ticker_label: "شريط الأخبار المباشر",
      ticker_placeholder: "اكتب إعلاناً عاماً للجمهور...",
      head_org_names_label: "رؤساء التنظيم (مثال: أحمد، سارة)",
      org_names_label: "أسماء المنظمين (مفصولين بفاصلة)",
      org_names_placeholder: "أحمد، سارة، إلخ...",
      print_placard: "طباعة",
      security_title: "لوحة المراقبة والحماية من البوتات",
      audio_soundboard: "لوحة المؤثرات الصوتية (المسرح)"
    }
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        if (u.email === 'master@htu.local') setRole('master');
        else if (u.email === 'organizer@htu.local') setRole('organizer');
        else setRole(null);
      } else {
        setRole(null);
      }
    });

    const qProjects = query(collection(db, 'projects'), orderBy('title', 'asc'));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
    });

    const qGallery = query(collection(db, 'gallery'), orderBy('timestamp', 'desc'));
    const unsubGallery = onSnapshot(qGallery, (snapshot) => {
      setGalleryImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]);
    });

    const unsubKiosk = onSnapshot(doc(db, 'config', 'kiosk'), (doc) => {
        if (doc.exists()) setKioskConfig(prev => ({ ...prev, ...doc.data() as any }));
    });

    return () => {
      unsubAuth();
      unsubProjects();
      unsubGallery();
      unsubKiosk();
    };
  }, []);

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
      });

      unsubConfig = onSnapshot(doc(db, 'config', 'voting'), (doc) => {
        if (doc.exists()) {
            setIsVotingOpen(doc.data().isOpen);
            setArchiveMode(doc.data().archiveMode || false);
        }
      });
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

  const activateArchiveMode = async () => {
      if (role !== 'master') return;
      const confirmation = window.prompt(t[lang].archive_prompt);
      if (confirmation !== 'ARCHIVE') return;

      setUploading(true);
      try {
          const batch = writeBatch(db);
          // Bake results into public projects collection
          results.forEach(r => {
              batch.update(doc(db, 'projects', r.id), { finalVotes: r.votes });
          });
          batch.update(doc(db, 'config', 'voting'), { isOpen: false, archiveMode: true });
          await batch.commit();
          alert('Archive Mode Activated successfully.');
      } catch (e: any) {
          alert(`Archive failed: ${e.message}`);
      } finally {
          setUploading(false);
      }
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
        await batch.commit();
        alert('Votes purged.');
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

          const batch = writeBatch(db);
          projectsSnap.forEach(d => batch.delete(d.ref));
          resultsSnap.forEach(d => batch.delete(d.ref));
          gallerySnap.forEach(d => batch.delete(d.ref));
          votersSnap.forEach(d => batch.delete(d.ref));
          batch.set(doc(db, 'stats', 'global'), { total: 0 });
          batch.update(doc(db, 'config', 'voting'), { archiveMode: false });

          await batch.commit();
          alert('SYSTEM WIPE COMPLETE. ALL DATA DELETED.');
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

  const filteredAndSortedTeams = projects
    .filter(p => {
        const s = teamSearchTerm.toLowerCase().trim();
        if (!s) return true;
        const title = (p.title || '').toLowerCase();
        const instructor = (p.instructor || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        return title.includes(s) || instructor.includes(s) || id.includes(s);
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
        <button className="back-to-site-inline" onClick={onBack}><ArrowLeft size={18} className={lang === 'ar' ? 'rotate-180' : ''} /> {t[lang].back}</button>
        <motion.div className="glass-card login-portal-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="login-header-elite">
            <div className="security-icon-wrapper"><ShieldCheck size={60} color="#E8343F" className="pulsing-icon" /></div>
            <h2>{t[lang].login_title}</h2>
            <p>{t[lang].authorized}</p>
          </div>
          <form onSubmit={handleLogin} className="elite-form">
            <div className="input-group-elite"><label>{t[lang].sys_user}</label><div className="input-wrapper"><UserCog size={20} className="field-icon" /><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Master / Organizer" required /></div></div>
            <div className="input-group-elite"><label>{t[lang].sys_pass}</label><div className="input-wrapper"><BarChart3 size={20} className="field-icon" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div></div>
            {error && <p className="error-text-elite"><AlertTriangle size={14} /> {error}</p>}
            <button type="submit" className="htu-button w-full login-btn-elite">{t[lang].init}</button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-elite" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="background-wrapper"><div className="bg-grid" /><div className="bg-mesh" /></div>
      
      {selectedPlacard && (
          <div className="placard-overlay">
              <div className="placard-preview elite-placard-v2">
                  <div className="placard-header-premium">
                      <img src="favicon.png" alt="HTU Logo" className="placard-htu-logo-giant" />
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
                      <div className="qr-box-premium">
                          <QRCodeCanvas 
                            value={`${window.location.origin}${window.location.pathname}?project=${selectedPlacard.id}`} 
                            size={450} 
                            level="H" 
                            includeMargin={false}
                            imageSettings={{
                                src: "favicon.png",
                                x: undefined,
                                y: undefined,
                                height: 120,
                                width: 120,
                                excavate: true,
                            }}
                          />
                      </div>
                      <div className="placard-scan-prompt">
                          <span>SCAN TO VOTE FOR THIS TEAM</span>
                      </div>
                  </div>

                  <div className="placard-footer-branding">
                      MADE BY NAJDAWI • POWERED BY HTU
                  </div>
              </div>
              <div className="placard-controls">
                  <button className="htu-button print-action-btn" onClick={() => window.print()}><Printer size={20}/> Send to Printer</button>
                  <button className="htu-button outline-btn placard-close" onClick={() => setSelectedPlacard(null)}>Exit Preview</button>
              </div>
          </div>
      )}

      <nav className="admin-nav-elite">
        <div className="nav-left">
            <button className="back-btn-elite" onClick={onBack}><ArrowLeft size={18} className={lang === 'ar' ? 'rotate-180' : ''} /> {t[lang].back}</button>
            <div className="lang-toggle-container admin-lang-fix">
                <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
                <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>AR</button>
            </div>
            <div className="role-badge"><div className={`status-dot ${role === 'master' ? 'master-dot' : 'organizer-dot'}`} /><span>{t[lang].sys} <strong>{role.toUpperCase()}</strong></span></div>
        </div>
        <div className="admin-tabs">
            <button className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /><span>{t[lang].tab_dashboard}</span></button>
            <button className={`admin-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}><ListChecks size={18} /><span>{t[lang].tab_teams}</span></button>
            <button className={`admin-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}><ImageIcon size={18} /><span>{t[lang].tab_gallery}</span></button>
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
                    <div className="danger-content"><AlertTriangle size={30} /><div className="text"><h3>{t[lang].archive_mode}</h3><p>{t[lang].archive_desc}</p></div></div>
                    <button onClick={activateArchiveMode} className="htu-button reset-btn-elite" disabled={uploading} style={{ background: '#f59e0b' }}>{uploading ? <Loader2 className="animate-spin" size={20} /> : t[lang].archive_btn}</button>
                </section>
                <section className="danger-zone-elite">
                    <div className="danger-content"><AlertTriangle size={30} /><div className="text"><h3>{t[lang].critical}</h3><p>{t[lang].critical_desc}</p></div></div>
                    <button onClick={handleResetData} className="htu-button reset-btn-elite" disabled={uploading}>{uploading ? <Loader2 className="animate-spin" size={20} /> : t[lang].purge}</button>
                </section>
                <section className="danger-zone-elite hard-reset-section" style={{ borderStyle: 'dashed', borderColor: '#ff0000' }}>
                    <div className="danger-content"><Bomb size={30} /><div className="text"><h3>{t[lang].hard_reset}</h3><p>{t[lang].hard_reset_desc}</p></div></div>
                    <button onClick={handleHardReset} className="htu-button reset-btn-elite" disabled={uploading} style={{ background: '#000' }}>{uploading ? <Loader2 className="animate-spin" size={20} /> : t[lang].hard_reset_btn}</button>
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
                          <thead><tr><th>{t[lang].p_title}</th><th>{t[lang].p_inst}</th><th>{t[lang].th_members}</th><th>{t[lang].th_section}</th><th>{t[lang].th_team_id}</th><th className="text-right">{t[lang].th_verify}</th></tr></thead>
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
                                          <div className="verification-actions">
                                              <button onClick={() => handleUpdateStatus(p.id, 'verified')} className={`verify-btn ${p.status === 'verified' ? 'active' : ''}`}><CheckCircle2 size={18} /></button>
                                              <button onClick={() => handleUpdateStatus(p.id, 'rejected')} className={`reject-btn ${p.status === 'rejected' ? 'active' : ''}`}><X size={18} /></button>
                                              <button onClick={() => handleUpdateStatus(p.id, 'none')} className="reset-status-btn"><RotateCcw size={14} /></button>
                                              {role === 'master' && (
                                                <button onClick={() => handleDeleteProject(p.id)} className="elite-delete-btn" style={{ marginLeft: '10px' }}><Trash2 size={18} /></button>
                                              )}
                                              {role === 'master' && (
                                                <label className="action-pill-btn" style={{ marginLeft: '10px' }}><Upload size={14} /><span>{t[lang].update}</span><input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpdateImage(p.id, f); }} className="hidden-file-input" /></label>
                                              )}
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
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
                        
                        {/* Audio Soundboard */}
                        <div className="stage-control-item glass-card" style={{ gridColumn: 'span 2' }}>
                            <div className="item-label"><Volume2 size={20} color="#FFD700" /> <span>{t[lang].audio_soundboard}</span></div>
                            <div className="soundboard-grid">
                                {['drumroll', 'heartbeat', 'applause', 'swoosh'].map(effect => (
                                    <button 
                                        key={effect}
                                        className={`sound-btn ${kioskConfig.activeAudio === effect ? 'active-audio' : ''}`} 
                                        onClick={() => updateKiosk({ activeAudio: effect })}
                                    >
                                        {effect === 'drumroll' && '🥁 Drumroll'}
                                        {effect === 'heartbeat' && '💓 Heartbeat'}
                                        {effect === 'applause' && '👏 Applause'}
                                        {effect === 'swoosh' && '💨 Swoosh'}
                                    </button>
                                ))}
                            </div>
                            <div className="audio-controls-row">
                                <button className="audio-play-btn" onClick={() => updateKiosk({ audioStatus: 'playing' })}><Play size={20}/> Play Loop</button>
                                <button className="audio-stop-btn" onClick={() => updateKiosk({ audioStatus: 'stopped' })}><X size={20}/> Stop Sound</button>
                            </div>
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
                            <div className="item-label" style={{ marginTop: '15px' }}><Users size={20} /> <span>{t[lang].org_names_label}</span></div>
                            <div className="ticker-input-wrapper"><input type="text" placeholder={t[lang].org_names_placeholder} value={kioskConfig.organizerNames || ""} onChange={(e) => updateKiosk({ organizerNames: e.target.value })} className="ticker-admin-input" /></div>
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
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(step => (
                                    <button key={step} onClick={() => updateKiosk({ revealStep: step, isPaused: true })} className={`scene-btn ${kioskConfig.revealStep === step ? 'active' : ''}`}>
                                        <div className="scene-number">{step}</div>
                                        <div className="scene-name">{t[lang][`ceremony_step_${step}` as keyof typeof t['ar']] as string}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="ceremony-actions" style={{ marginTop: '20px' }}>
                                <button className="stage-icon-btn" onClick={() => updateKiosk({ revealStep: Math.max(0, kioskConfig.revealStep - 1), isPaused: true })}><Rewind size={24} /></button>
                                <button className="stage-play-pause-btn" onClick={() => updateKiosk({ isPaused: !kioskConfig.isPaused })}>{kioskConfig.isPaused ? <Play size={32} /> : <Pause size={32} />}</button>
                                <button className="stage-icon-btn" onClick={() => updateKiosk({ revealStep: Math.min(8, kioskConfig.revealStep + 1), isPaused: true })}><SkipForward size={24} /></button>
                                <button className="stage-reset-btn" onClick={() => updateKiosk({ revealStep: 0, isPaused: true })}><RotateCcw size={20} /> <span>{t[lang].reveal_reset}</span></button>
                            </div>
                        </motion.div>
                    )}
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
      </main>
      <footer className="admin-footer-elite"><p>&copy; 2026 Al-Hussein Technical University.</p><p className="credits">{t[lang].footer_text}</p></footer>
    </div>
  );
}