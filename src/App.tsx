import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { CheckCircle2, Users, Search, Loader2, Settings, X, Share2, Info, Download, Trophy, Sparkles, Trophy as TrophyIcon, ShieldCheck, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, runTransaction, query, orderBy, onSnapshot, increment, setDoc } from 'firebase/firestore';
import AdminPanel from './AdminPanel';
import './App.css';

interface Project {
  id: string; title: string; instructor: string; team_members: string; section_number?: string; status?: 'none' | 'verified' | 'rejected'; imageUrl?: string; finalVotes?: number;
}

interface GalleryImage {
  id: string; imageUrl: string; timestamp: number;
}

function App() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const [view, setView] = useState<'public' | 'admin' | 'kiosk' | 'archive-control'>('public');
  const [activeTab, setActiveTab] = useState<'projects' | 'gallery'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [results, setResults] = useState<Record<string, number>>({});
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [voterData, setVoterData] = useState<{ voteCount: number; votedProjectIds: string[] }>({ voteCount: 0, votedProjectIds: [] });
  const [initialSplash, setInitialSplash] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [logoClicks, setLogoClicks] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [globalVotes, setGlobalVotes] = useState(0);
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [archiveMode, setArchiveMode] = useState(false);
  const [hofSelection, setHofSelection] = useState<string[]>(['', '', '', '', '']);

  // Kiosk Orchestration State
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
  const [kioskCycleIndex, setKioskCycleIndex] = useState(0); // 0=Leaderboard, 1=Gallery, 2=Branding

  const [showBadge, setShowBadge] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [voterName, setVoterName] = useState('');
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [certImage, setCertImage] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string | null>(null);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if (data.ip) setClientIp(data.ip);
      } catch (e) {
        console.error("Failed to fetch IP:", e);
      }
    };
    fetchIp();
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = {
    en: {
      title: "Engineering Design Expo",
      subtitle: (count: number) => `Choose your Fan Favorite projects. You have ${count} votes remaining.`,
      votes_cast: "TOTAL VOTES CAST",
      search: "Search projects or instructors...",
      gallery: "Project Gallery",
      expo_count: "Projects in the Expo",
      vote: "Vote",
      voted: "Voted",
      cast_vote: "Cast Vote",
      share_team: "Share Team",
      team_members: "Team Members",
      achievement: "Achievement Unlocked!",
      achievement_sub: "Enter your name to generate your majestic voter certificate.",
      display_name: "Display Name",
      placeholder_name: "Your Name",
      generate: "Generate Certificate",
      download: "Download Certificate (PNG)",
      close: "Close",
      welcome: "Welcome to HTU Expo 2026",
      welcome_sub: "Cast your 3 votes to support engineering excellence!",
      f1: "Weighted Voting: 1st (3pts), 2nd (2pts), 3rd (1pt)",
      f2: "Search: Find any team or instructor instantly",
      f3: "Share: Spread the word about your favorite teams",
      f4: "Badge: Claim your certificate after 3 votes!",
      start: "Let's Start",
      org_login: "Organizer Login",
      cert_title: "OFFICIAL VOTER CERTIFICATE",
      cert_presented: "THIS CERTIFICATE IS PROUDLY PRESENTED TO",
      cert_contribution: "FOR EXCEPTIONAL CONTRIBUTION AND SUPPORT TO THE",
      cert_expo: "ENGINEERING DESIGN EXPO 2026",
      cert_auth: "VERIFIED AUTH",
      tab_projects: "Engineering Projects",
      tab_gallery: "Live Event Photos",
      ceremony_0: "PREPARING REVEAL",
      ceremony_step_0: "INTRO COUNTDOWN",
      ceremony_step_1: "SPECIAL THANKS",
      ceremony_step_2: "UNDER THE PATRONAGE OF",
      ceremony_step_3: "SPECIAL THANKS",
      ceremony_step_4: "OUR INSTRUCTORS",
      ceremony_step_5: "THE EXPO ORGANIZERS",
      ceremony_step_6: "THE HEAD ORGANIZERS",
      ceremony_step_7: "SPECIAL RECOGNITION",
      ceremony_step_8: "OUR VOLUNTEERS",
      ceremony_step_9: "THE 5TH PLACE - FAN FAVORITE",
      ceremony_step_10: "THE 4TH PLACE - JUDGING AWARD",
      ceremony_step_11: "THE 3RD PLACE - JUDGING AWARD",
      ceremony_step_12: "THE 2ND PLACE - JUDGING AWARD",
      ceremony_step_13: "THE GRAND CHAMPION 2026",
      kiosk_live: "LIVE LEADERBOARD",
      kiosk_gallery: "EVENT PHOTO STREAM",
      credit_1_main: "AL-HUSSEIN TECHNICAL UNIVERSITY",
      credit_2_main: "HTU PRESIDENCY",
      credit_3_main: "OUR INSTRUCTORS & STUDENTS",
      credit_5_main: "THE EXPO ORGANIZERS",
      credit_7_main: "TO OUR DEDICATED VOLUNTEERS",
      archived_title: "HTU EXPO 2026 - OFFICIAL HALL OF FAME"
    },
    ar: {
      title: "معرض التصميم الهندسي",
      subtitle: (count: number) => `اختر مشاريعك الهندسية المفضلة. متبقي لديك ${count} أصوات.`,
      votes_cast: "إجمالي الأصوات",
      search: "ابحث عن المشاريع أو المشرفين...",
      gallery: "معرض المشاريع",
      expo_count: "مشروعاً في المعرض",
      vote: "تصويت",
      voted: "تم التصويت",
      cast_vote: "تأكيد التصويت",
      share_team: "شارك الفريق",
      team_members: "أعضاء الفريق",
      achievement: "إنجاز جديد!",
      achievement_sub: "أدخل اسمك لإصدار شهادة التصويت المعتمدة الخاصة بك.",
      display_name: "الاسم بالكامل",
      placeholder_name: "أدخل اسمك هنا",
      generate: "إصدار الشهادة",
      download: "تحميل الشهادة (PNG)",
      close: "إغلاق",
      welcome: "مرحباً بكم في معرض HTU 2026",
      welcome_sub: "امنح صوتك لأفضل الابتكارات الهندسية!",
      f1: "نظام النقاط: الخيار الأول (3 نقاط)، الثاني (نقطتان)، الثالث (نقطة)",
      f2: "البحث الذكي: اعثر على أي فريق أو مشرف بسرعة",
      f3: "المشاركة: ساعد في نشر مشاريع فرقك المفضلة",
      f4: "الشهادة المعتمدة: احصل على شهادة تقدير بعد إتمام التصويت!",
      start: "ابدأ الآن",
      org_login: "دخول المنظمين",
      cert_title: "شهادة تصويت معتمدة",
      cert_presented: "تمنح هذه الشهادة بكل فخر إلى",
      cert_contribution: "تقديراً لمساهمته الفعالة ودعمه للابتكار في",
      cert_expo: "معرض التصميم الهندسي 2026",
      cert_auth: "رمز التحقق",
      tab_projects: "المشاريع الهندسية",
      tab_gallery: "صور المعرض المباشر",
      ceremony_0: "تجهيز النتائج",
      ceremony_step_0: "العد التنازلي",
      ceremony_step_1: "شكر خاص",
      ceremony_step_2: "تحت رعاية",
      ceremony_step_3: "شكر خاص",
      ceremony_step_4: "المشرفين والأساتذة",
      ceremony_step_5: "منظمي المعرض",
      ceremony_step_6: "رؤساء اللجنة المنظمة",
      ceremony_step_7: "تقدير خاص",
      ceremony_step_8: "فريق المتطوعين",
      ceremony_step_9: "المركز الخامس - تصويت الجمهور",
      ceremony_step_10: "المركز الرابع - جائزة التحكيم",
      ceremony_step_11: "المركز الثالث - جائزة التحكيم",
      ceremony_step_12: "المركز الثاني - جائزة التحكيم",
      ceremony_step_13: "إعلان البطل الأول",
      kiosk_live: "لوحة النتائج المباشرة",
      kiosk_gallery: "بث صور المعرض",
      credit_1_main: "جامعة الحسين التقنية",
      credit_2_main: "رئاسة الجامعة",
      credit_3_main: "المشرفين والطلبة",
      credit_5_main: "منظمي المعرض",
      credit_7_main: "إلى متطوعينا المخلصين",
      archived_title: "معرض 2026 - الأرشيف الرسمي للنتائج"
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kiosk') === 'true') setView('kiosk');
    if (params.get('archive-control') === 'true') setView('archive-control');
    const hasSeen = localStorage.getItem('htu_onboarding_seen');
    if (!hasSeen && params.get('kiosk') !== 'true') setTimeout(() => setShowOnboarding(true), 3500);

    signInAnonymously(auth).catch(console.error);
    
    let unsubscribeVoter = () => {};
    let unsubscribeProjects = () => {};
    let unsubscribeGallery = () => {};
    let unsubStats = () => {};
    let unsubscribeResults = () => {};
    let unsubConfig = () => {};
    let unsubKiosk = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        
        if (!user.email?.includes('@htu.local')) {
          const voterRef = doc(db, 'voters', user.uid);
          unsubscribeVoter = onSnapshot(voterRef, (doc) => { if (doc.exists()) setVoterData(doc.data() as any); });
        }

        const projectsQuery = query(collection(db, 'projects'), orderBy('title', 'asc'));
        unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
          const projectsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
          setProjects(prev => {
            if (prev.length === 0) return [...projectsList].sort(() => 0.5 - Math.random());
            const updated = prev.map(p => { const fresh = projectsList.find(pl => pl.id === p.id); return fresh ? { ...p, ...fresh } : p; });
            const prevIds = prev.map(p => p.id);
            const newOnes = projectsList.filter(pl => !prevIds.includes(pl.id));
            return [...updated, ...newOnes];
          });
          setTimeout(() => setInitialSplash(false), 3500);
        });

        const galleryQuery = query(collection(db, 'gallery'), orderBy('timestamp', 'desc'));
        unsubscribeGallery = onSnapshot(galleryQuery, (snapshot) => {
          setGalleryImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GalleryImage[]);
        });

        unsubStats = onSnapshot(doc(db, 'stats', 'global'), (doc) => { if (doc.exists()) setGlobalVotes(doc.data().total || 0); });
        
        if (user.email?.includes('@htu.local')) {
          unsubscribeResults = onSnapshot(collection(db, 'results'), (snapshot) => {
              const resMap: Record<string, number> = {};
              snapshot.docs.forEach(doc => { resMap[doc.id] = doc.data().votes || 0; });
              setResults(resMap);
          });
        }

        unsubConfig = onSnapshot(doc(db, 'config', 'voting'), (doc) => { 
            if (doc.exists()) {
                setIsVotingOpen(doc.data().isOpen);
                setArchiveMode(doc.data().archiveMode || false);
                setHofSelection(doc.data().hofSelection || ['', '', '', '', '']);
            }
        });

        unsubKiosk = onSnapshot(doc(db, 'config', 'kiosk'), (doc) => { 
            if (doc.exists()) {
                const data = doc.data() as any;
                setKioskConfig(prev => ({ ...prev, ...data }));
            }
        });
      } else {
        setUserId(null); 
        setVoterData({ voteCount: 0, votedProjectIds: [] }); 
        
        unsubscribeVoter();
        unsubscribeProjects();
        unsubscribeGallery();
        unsubStats();
        unsubscribeResults();
        unsubConfig();
        unsubKiosk();
      }
    });

    return () => { 
        unsubscribeAuth(); 
        unsubscribeProjects(); 
        unsubscribeVoter(); 
        unsubStats(); 
        unsubConfig(); 
        unsubscribeGallery(); 
        unsubKiosk(); 
        unsubscribeResults(); 
    };
  }, [view]);

  // Kiosk Auto-Rotation Timer
  useEffect(() => {
    let interval: any;
    if (view === 'kiosk' && kioskConfig.autoRotate && !kioskConfig.victoryMode) {
        interval = setInterval(() => {
            setKioskCycleIndex(prev => (prev + 1) % 3);
        }, 15000);
    } else {
        setKioskCycleIndex(0);
    }
    return () => clearInterval(interval);
  }, [view, kioskConfig.autoRotate, kioskConfig.victoryMode]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedProjectId = urlParams.get('project');
    if (sharedProjectId && projects.length > 0 && !selectedProject) {
        const found = projects.find(p => p.id === sharedProjectId);
        if (found) { setSelectedProject(found); window.history.replaceState({}, document.title, window.location.pathname); }
    }
  }, [projects]);

  useEffect(() => { if (voterData.voteCount === 3 && !localStorage.getItem('htu_badge_shown')) { setShowBadge(true); localStorage.setItem('htu_badge_shown', 'true'); } }, [voterData.voteCount]);

  const closeOnboarding = () => { setShowOnboarding(false); localStorage.setItem('htu_onboarding_seen', 'true'); };

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    if (newClicks >= 5) { setView('admin'); setLogoClicks(0); } else { setLogoClicks(newClicks); }
  };

  const handleShare = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?project=${project.id}`;
    if (navigator.share) {
        navigator.share({ title: `Vote for ${project.title}`, text: `Check out ${project.title} at the HTU Engineering Design Expo!`, url: shareUrl }).catch(console.error);
    } else {
        navigator.clipboard.writeText(shareUrl); alert('Team link copied to clipboard!');
    }
  };

  const handleVote = async (projectId: string) => {
    if (!isVotingOpen) { alert("Voting is currently closed by the organizers."); return; }
    if (!userId || voterData.voteCount >= 3) return;
    if (voterData.votedProjectIds.includes(projectId)) return;

    let ip = clientIp;
    if (!ip) {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip || null;
        if (ip) setClientIp(ip);
      } catch (e) {
        console.error("Failed to fetch IP on demand:", e);
      }
    }

    let ipDocId: string;
    if (ip) {
      ipDocId = ip.replace(/[\.:]/g, '_');
    } else {
      let deviceId = localStorage.getItem('htu_device_id');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('htu_device_id', deviceId);
      }
      ipDocId = 'dev_' + deviceId;
    }

    const prevData = { ...voterData };
    setVoterData(prev => ({ voteCount: prev.voteCount + 1, votedProjectIds: [...prev.votedProjectIds, projectId] }));
    setVotingId(projectId);
    try {
      const voterRef = doc(db, 'voters', userId);
      const resultRef = doc(db, 'results', projectId);
      const statsRef = doc(db, 'stats', 'global');
      const ipRef = doc(db, 'ips', ipDocId);

      await runTransaction(db, async (transaction) => {
        const voterSnap = await transaction.get(voterRef);
        const currentVoterData = voterSnap.exists() ? voterSnap.data() : { voteCount: 0, votedProjectIds: [] };
        if (currentVoterData.voteCount >= 3 || currentVoterData.votedProjectIds.includes(projectId)) throw "LIMIT_REACHED";

        const ipSnap = await transaction.get(ipRef);
        const currentIpVotes = ipSnap.exists() ? ipSnap.data().voteCount || 0 : 0;
        if (currentIpVotes >= 3) throw "IP_LIMIT_REACHED";

        const voteWeight = 3 - currentVoterData.voteCount;
        transaction.set(voterRef, { voteCount: currentVoterData.voteCount + 1, votedProjectIds: [...currentVoterData.votedProjectIds, projectId] }, { merge: true });
        transaction.set(resultRef, { votes: increment(voteWeight) }, { merge: true });
        transaction.set(statsRef, { total: increment(1) }, { merge: true });
        transaction.set(ipRef, { voteCount: currentIpVotes + 1 }, { merge: true });
      });
      const isMobile = window.innerWidth <= 768;
      confetti({ particleCount: isMobile ? 50 : 150, spread: isMobile ? 50 : 80, origin: { y: 0.6 }, colors: ['#E8343F', '#FFFFFF', '#020B18', '#FFD700'] });
    } catch (error: any) {
      setVoterData(prevData);
      if (error === "IP_LIMIT_REACHED") {
        alert("This device or network has already cast the maximum number of votes (3). Multi-session voting is disallowed.");
      } else if (error !== "LIMIT_REACHED") {
        console.error('Voting Error:', error);
      }
    } finally {
      setVotingId(null);
    }
  };

  const generateNativeCertificate = async (name: string, hash: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#01060D'; ctx.fillRect(0, 0, 1920, 1080);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 1;
    for (let i = 0; i < 1920; i += 80) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1080); ctx.stroke(); }
    for (let i = 0; i < 1080; i += 80) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1920, i); ctx.stroke(); }

    const glow = ctx.createRadialGradient(960, 540, 0, 960, 540, 800);
    glow.addColorStop(0, 'rgba(232, 52, 63, 0.15)'); glow.addColorStop(1, 'rgba(1, 6, 13, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 1920, 1080);

    ctx.strokeStyle = 'rgba(232, 52, 63, 0.4)'; ctx.lineWidth = 14; ctx.strokeRect(60, 60, 1800, 960);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 2; ctx.strokeRect(84, 84, 1752, 912);

    try {
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = 'favicon.png';
        await new Promise((res) => { img.onload = res; img.onerror = res; });
        ctx.drawImage(img, 960 - 75, 120, 150, 150);
    } catch(e) {}

    ctx.textAlign = 'center'; ctx.fillStyle = '#E8343F';
    ctx.beginPath(); 
    if (ctx.roundRect) ctx.roundRect(960 - 350, 320, 700, 60, 30); else ctx.fillRect(960 - 350, 320, 700, 60);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 24px Montserrat, Tajawal, sans-serif'; 
    ctx.fillText(t[lang].cert_title, 960, 358);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = '600 28px Montserrat, Tajawal, sans-serif'; 
    ctx.fillText(t[lang].cert_presented, 960, 480);

    ctx.fillStyle = '#FFFFFF'; let fSize = 150; 
    ctx.font = `900 ${fSize}px Montserrat, Tajawal, sans-serif`;
    while (ctx.measureText(name.toUpperCase()).width > 1600 && fSize > 40) { fSize -= 5; ctx.font = `900 ${fSize}px Montserrat, Tajawal, sans-serif`; }
    ctx.fillText(name.toUpperCase(), 960, 620);

    const lg = ctx.createLinearGradient(960 - 300, 0, 960 + 300, 0); lg.addColorStop(0, 'rgba(232, 52, 63, 0)'); lg.addColorStop(0.5, 'rgba(232, 52, 63, 1)'); lg.addColorStop(1, 'rgba(232, 52, 63, 0)');
    ctx.fillStyle = lg; ctx.fillRect(960 - 300, 720, 600, 4);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.font = 'bold 30px Montserrat, Tajawal, sans-serif'; 
    ctx.fillText(t[lang].cert_contribution, 960, 810);

    ctx.fillStyle = '#FFFFFF'; ctx.font = '900 65px Montserrat, Tajawal, sans-serif'; 
    ctx.fillText(t[lang].cert_expo, 960, 900);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.font = '22px monospace'; 
    ctx.fillText(`${t[lang].cert_auth}: ${hash}`, 960, 1000);

    return canvas.toDataURL('image/png', 1.0);
  };

  const handleGenerateCertificate = async () => {
    setIsGenerating(true); setIsNameSubmitted(true);
    const hash = userId?.substring(0, 16).toUpperCase() || 'SESSION_EXPIRED';
    setTimeout(async () => {
        const dataUrl = await generateNativeCertificate(voterName, hash);
        setCertImage(dataUrl); setIsGenerating(false);
    }, 100);
  };

  const downloadBadge = () => {
    if (!certImage) return;
    const link = document.createElement('a');
    link.download = `HTU_Expo_Certificate_${voterName.replace(/\s+/g, '_')}.png`;
    link.href = certImage; link.click();
  };

  const filteredProjects = projects.filter(p => {
    const s = searchTerm.toLowerCase();
    const title = p.title?.toLowerCase() || '';
    const team = p.team_members?.toLowerCase() || '';
    const instructor = p.instructor?.toLowerCase() || '';
    return title.includes(s) || team.includes(s) || instructor.includes(s);
  });

  const displayProjects = archiveMode 
    ? [...filteredProjects].sort((a, b) => ((b as any).finalVotes || 0) - ((a as any).finalVotes || 0))
    : filteredProjects;

  const unrankedProjects = displayProjects.filter(p => !hofSelection.includes(p.id));
  const hofProjects = hofSelection.map(id => displayProjects.find(p => p.id === id) || null);

  if (initialSplash) {
    return (
      <motion.div className="splash-screen" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }} transition={{ duration: 1, ease: [0.43, 0.13, 0.23, 0.96] }}>
        <div className="splash-bg-anim" />
        <div className="splash-content">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 1.5 }} className="splash-branding-top">Reimagining HTU's EXPOs</motion.div>
          <div className="logo-container-premium">
              <div className="splash-ring ring-1" /><div className="splash-ring ring-2" /><div className="splash-ring ring-3" />
              <motion.img initial={{ scale: 0.5, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} src="favicon.png" alt="HTU Logo" className="splash-logo" />
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="splash-loader-container">
            <motion.div className="splash-loader" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3.5, ease: "easeInOut" }} />
          </motion.div>
          <motion.p initial={{ opacity: 0, letterSpacing: '2px' }} animate={{ opacity: 0.8, letterSpacing: '12px' }} transition={{ delay: 0.8, duration: 1.5 }} className="splash-text">Engineering Design Expo 2026</motion.p>
        </div>
      </motion.div>
    );
  }

  if (view === 'kiosk') {
    const topProjects = projects.map(p => ({
        ...p,
        votes: results[p.id] || 0
    })).sort((a,b) => b.votes - a.votes);
    
    const top10 = topProjects.slice(0, 10);
    const currentSubView = kioskCycleIndex === 0 ? 'leaderboard' : kioskCycleIndex === 1 ? 'gallery' : 'branding';

    // Map Kiosk/Ceremony Selection Projects
    const ceremonySelection = kioskConfig.ceremonySelection || ['', '', '', '', ''];
    const revealProjects = ceremonySelection.map(id => projects.find(p => p.id === id) || null);
    
    return (
        <div className={`kiosk-mode ${kioskConfig.revealStep === 13 ? 'champion-active' : ''}`}>
            <div className="background-wrapper"><div className="bg-grid" /><div className="bg-mesh" /></div>        

            {kioskConfig.tickerText && (
                <div className="kiosk-ticker">
                    <div className="ticker-wrapper">
                        <div className="ticker-content">
                            <span>{kioskConfig.tickerText}</span>
                            <span>{kioskConfig.tickerText}</span>
                            <span>{kioskConfig.tickerText}</span>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {kioskConfig.victoryMode && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className={`victory-reveal-overlay ${kioskConfig.revealStep === 13 ? 'champion-active' : ''}`}
                    >
                        <div className="ceremony-bg">
                            <motion.div
                                animate={{
                                    scale: [1, 1.3, 1],
                                    rotate: [0, 90, 180, 270, 360],
                                    opacity: [0.2, 0.5, 0.2]
                                }}
                                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                className="spotlight-god-v2"
                            />
                            <div className="ceremony-particles-v2" />
                            <div className="ceremony-hyper-grid" />
                        </div>

                        <div className="ceremony-content-ultimate">
                            {/* Majestic Minimalist Intro */}
                            {(kioskConfig.isPaused || kioskConfig.revealStep === 0) ? (
                                <motion.div 
                                    key="intro" 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    exit={{ opacity: 0, scale: 1.1, filter: 'blur(100px)' }} 
                                    transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
                                    className="ceremony-intro-ultimate"
                                >
                                    <motion.div 
                                        initial={{ y: 100, opacity: 0 }} 
                                        animate={{ y: 0, opacity: 1 }} 
                                        transition={{ duration: 1.5, delay: 0.5, ease: "circOut" }}
                                        className="ceremony-top-branding God-Text-V2 glow-text-extreme"
                                    >
                                        REIMAGINING HTU's EXPOs
                                    </motion.div>

                                    <motion.div 
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 1.5, delay: 1.2 }}
                                        className="logo-bottom-center"
                                    >
                                        <img src="favicon.png" alt="HTU" style={{ height: '120px' }} />
                                    </motion.div>
                                </motion.div>
                            ) : null}

                            {/* Slides 1-8: Pristine Typographic Credits */}
                            {!kioskConfig.isPaused && kioskConfig.revealStep >= 1 && kioskConfig.revealStep <= 8 && (
                                <motion.div 
                                    key={`credit-min-${kioskConfig.revealStep}`}
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -50 }}
                                    transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
                                    className="credits-container-ultimate"
                                >
                                    <motion.span 
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}
                                        className="credits-subtitle-ultimate"
                                    >
                                        {t[lang][`ceremony_step_${kioskConfig.revealStep}` as keyof typeof t['en']] as string}
                                    </motion.span>

                                    {kioskConfig.revealStep === 6 ? (
                                        <div className="organizer-cloud-ultimate">
                                            {kioskConfig.headOrganizerNames && (
                                                <div className="head-org-grid-ultimate">
                                                    {kioskConfig.headOrganizerNames.split(',').map((name, i) => (
                                                        <motion.div 
                                                            key={name} 
                                                            initial={{ opacity: 0, y: 30 }} 
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.8 + (i * 0.2), duration: 1 }}
                                                            className="head-name-ultimate head-name-small"
                                                        >
                                                            {name.trim()}
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (kioskConfig.revealStep === 8 || kioskConfig.revealStep === 4) ? (
                                        <div className="general-org-ultimate">
                                            <motion.div 
                                                initial="hidden" animate="visible" 
                                                variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.8 } } }} 
                                                className="volunteer-grid-fixed"
                                            >
                                                {(kioskConfig.revealStep === 8 ? kioskConfig.volunteerNames : kioskConfig.instructorNamesExtra)?.split(',').map((name) => (
                                                    <motion.span 
                                                        key={name} 
                                                        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} 
                                                        className="volunteer-name-elegant"
                                                    >
                                                        {name.trim()}
                                                    </motion.span>
                                                ))}
                                            </motion.div>
                                        </div>
                                    ) : (
                                        <motion.div 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 1, duration: 2 }}
                                            className="credits-main-ultimate"
                                        >
                                            {t[lang][`credit_${kioskConfig.revealStep === 5 ? 5 : kioskConfig.revealStep === 7 ? 7 : (kioskConfig.revealStep > 5 ? kioskConfig.revealStep - 1 : kioskConfig.revealStep)}_main` as keyof typeof t['en']] as string}
                                            <div className="god-line-ultimate" />
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {/* Slides 9-13: Borderless Cinematic Winner Moments (Top 5) */}
                            {!kioskConfig.isPaused && kioskConfig.revealStep >= 9 && (
                                <motion.div 
                                    key={`winner-min-${kioskConfig.revealStep}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 2 }}
                                    className="winner-reveal-ultimate-moment"
                                >
                                    <div className="winner-title-ultimate">
                                        {t[lang][`ceremony_step_${kioskConfig.revealStep}` as keyof typeof t['en']] as string}
                                    </div>

                                    {revealProjects[13 - kioskConfig.revealStep] && (
                                        <>
                                            <motion.div 
                                                initial={{ scale: 0.9, opacity: 0 }} 
                                                animate={{ scale: 1, opacity: 1 }} 
                                                transition={{ duration: 1.5, delay: 0.5, ease: "circOut" }}
                                                className="winner-photo-wrapper-ultimate"
                                            >
                                                <motion.img 
                                                    animate={{ scale: [1, 1.05, 1] }}
                                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                                    src={revealProjects[13 - kioskConfig.revealStep]?.imageUrl || 'hero.png'} alt="Winner" 
                                                />
                                            </motion.div>

                                            <div className="winner-details-ultimate">
                                                <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 0.2 }} transition={{ delay: 1.2, duration: 1.5 }} className="winner-rank-hologram">
                                                    <span>#{14 - kioskConfig.revealStep}</span>
                                                </motion.div>
                                                <motion.h3 initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5, duration: 1.5 }} className="winner-name-ultimate">{revealProjects[13 - kioskConfig.revealStep]?.title}</motion.h3>
                                                <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 0.4 }} transition={{ delay: 1.8, duration: 1.5 }} className="winner-instructor-ultimate">{revealProjects[13 - kioskConfig.revealStep]?.team_members}</motion.p>

                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 1.5 }} className="winner-votes-ultimate">
                                                    <strong>{kioskConfig.revealStep === 9 ? 'FAN FAV PROJECT' : 'JUDGING AWARD'}</strong>
                                                    <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>{kioskConfig.revealStep === 9 ? 'MOST VOTED BY HTU COMMUNITY' : 'OFFICIAL JURY SELECTION'}</span>
                                                </motion.div>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!kioskConfig.victoryMode && (
                <div className="kiosk-content-area">
                    {/* Fixed High-End Header without Rotating Logo */}
                    <div className="kiosk-header">
                        <div className="kiosk-logo-group">
                            <AnimatePresence mode="wait">
                                <motion.h1 
                                    key={currentSubView}
                                    initial={{ y: 20, opacity: 0 }} 
                                    animate={{ y: 0, opacity: 1 }} 
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {currentSubView === 'leaderboard' ? t[lang].kiosk_live : currentSubView === 'gallery' ? t[lang].kiosk_gallery : 'HTU EXPO 2026'}
                                </motion.h1>
                            </AnimatePresence>
                        </div>
                        <div className="global-counter-pill">
                            <span className="pulse-dot"></span>
                            <strong>{globalVotes.toLocaleString()}</strong> TOTAL VOTES
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {currentSubView === 'leaderboard' && (
                            <motion.div 
                                key="lead" 
                                initial={{ opacity: 0, rotateY: 90, x: 200 }} 
                                animate={{ opacity: 1, rotateY: 0, x: 0 }} 
                                exit={{ opacity: 0, rotateY: -90, x: -200 }} 
                                transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }} 
                                className="kiosk-sub-view"
                            >
                                <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }} className="kiosk-list">
                                    {top10.map((p, i) => {
                                        const maxVotes = (top10[0] as any)?.votes || 1;
                                        const currentVotes = (p as any).votes || 0;
                                        const barWidth = (currentVotes / maxVotes) * 100;

                                        return (
                                            <motion.div
                                                key={p.id}
                                                layout
                                                variants={{
                                                    hidden: { x: -100, opacity: 0, rotateX: 45 },
                                                    visible: { x: 0, opacity: 1, rotateX: 0 }
                                                }}
                                                className={`kiosk-item-v2 rank-row-${i+1} ${kioskConfig.hideResults ? 'masked' : ''}`}
                                            >
                                                <div className="rank-v2">{i+1}</div>
                                                <div className="item-main-v2">
                                                    <h3 className={kioskConfig.hideResults ? 'glitch-mask' : ''}>{p.title}</h3>
                                                    <p className={kioskConfig.hideResults ? 'glitch-mask' : ''}>{p.instructor}</p>
                                                </div>
                                                <div className="item-bar-container-v2">
                                                    <motion.div
                                                        className={`item-bar-v2 bar-rank-${i+1} ${kioskConfig.hideResults ? 'glitch-mask' : ''}`}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${barWidth}%` }}
                                                        transition={{ type: "spring", stiffness: 40, damping: 15 }}
                                                    />
                                                    <div className="item-bar-shimmer" />
                                                </div>
                                                <div className={`item-votes-v2 ${kioskConfig.hideResults ? 'glitch-mask' : ''}`}>
                                                    <strong>{currentVotes.toLocaleString()}</strong>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            </motion.div>
                        )}

                        {currentSubView === 'gallery' && (
                            <motion.div
                                key="gal"
                                initial={{ opacity: 0, rotateY: 90, x: 200 }}
                                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                                exit={{ opacity: 0, rotateY: -90, x: -200 }}
                                transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
                                className="kiosk-sub-view"
                            >
                                <motion.div
                                    initial="hidden" animate="visible"
                                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                                    className="gallery-masonry-v2"
                                >
                                    {galleryImages.slice(0, 12).map((img) => (
                                        <motion.div
                                            key={img.id}
                                            variants={{ hidden: { scale: 0.5, opacity: 0, rotate: -15 }, visible: { scale: 1, opacity: 1, rotate: 0 } }}
                                            whileHover={{ scale: 1.1, zIndex: 10, rotate: 2 }}
                                            className="gallery-item-v2"
                                        >
                                            <img src={img.imageUrl} alt="Event" />
                                            <div className="img-overlay-v2" />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </motion.div>
                        )}

                        {currentSubView === 'branding' && (
                            <motion.div
                                key="brand"
                                initial={{ opacity: 0, rotateY: 90, x: 200 }}
                                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                                exit={{ opacity: 0, rotateY: -90, x: -200 }}
                                transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
                                className="kiosk-sub-view kiosk-branding-view"
                            >
                                <div className="branding-container-ultimate">
                                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }} className="branding-text-ultimate">
                                        <h2 className="title-top">HTU ENGINEERING</h2>
                                        <h2 className="title-main">DESIGN EXPO</h2>
                                        <div className="title-divider-ultimate" />
                                        <p className="title-year">ESTABLISHED 2026</p>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <button className="exit-kiosk" onClick={() => setView('public')}>Exit Kiosk</button>
        </div>
    );
  }

  if (view === 'admin') {
    return (
      <div className="admin-view-wrapper">
        <AdminPanel lang={lang} setLang={setLang} onBack={() => setView('public')} />
      </div>
    );
  }

  if (view === 'archive-control') {
    return (
        <div className="archive-control-standalone">
            <div className="background-wrapper"><div className="bg-grid" /><div className="bg-mesh" /></div>        
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card archive-admin-card" style={{ maxWidth: '800px', padding: '60px' }}>
                <ShieldCheck size={64} color="#FFD700" className="mb-6 mx-auto" style={{ display: 'block', margin: '0 auto 20px' }} />
                <h1>Archive Control Center</h1>
                <p>Configure and toggle the HTU Expo 2026 Hall of Fame.</p>
                <div className={`archive-status-indicator ${archiveMode ? 'active' : 'idle'}`}>
                    {archiveMode ? 'SYSTEM ARCHIVED' : 'SYSTEM LIVE'}
                </div>

                <div className="hof-selection-container" style={{ margin: '30px 0', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ color: 'white', marginBottom: '20px', fontSize: '1.2rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px' }}>Set Top 5 Projects</h3>
                    {[0, 1, 2, 3, 4].map(idx => (
                        <div key={idx} style={{ marginBottom: '15px' }}>
                            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', display: 'block', marginBottom: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                {idx === 0 ? '1st Place (Judging)' : idx === 1 ? '2nd Place (Judging)' : idx === 2 ? '3rd Place (Judging)' : idx === 3 ? '4th Place (Judging)' : '5th Place (Fan Fav)'}
                            </label>
                            <select
                                value={hofSelection[idx] || ''}
                                onChange={(e) => {
                                    const newSelection = [...hofSelection];
                                    newSelection[idx] = e.target.value;
                                    setHofSelection(newSelection);
                                }}
                                style={{ width: '100%', padding: '15px 20px', borderRadius: '16px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                <option value="" style={{ color: '#888' }}>-- Select Project --</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title} ({p.instructor})</option>)}
                            </select>
                        </div>
                    ))}
                </div>

                <button
                    className={`htu-button w-full ${archiveMode ? 'outline-btn' : ''}`}
                    onClick={async () => {
                        const confirmation = window.confirm("Save configuration and Toggle Archive Mode?");
                        if (confirmation) {
                            const votingRef = doc(db, 'config', 'voting');
                            await setDoc(votingRef, { archiveMode: !archiveMode, isOpen: archiveMode, hofSelection }, { merge: true });
                        }
                    }}
                >
                    {archiveMode ? 'Disable Archive Mode' : 'SAVE & ACTIVATE HALL OF FAME'}
                </button>
                <button className="back-to-site-inline mt-8" onClick={() => setView('public')}>Return to Public Site</button>
            </motion.div>
        </div>
    );
  }

  return (
    <div className="app-container" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {archiveMode && (
          <div className="archive-banner">{t[lang].archived_title}</div>
      )}
      <motion.div className="level-slider-container" style={{ scaleY }} />
      <div className={`background-wrapper ${archiveMode ? 'archive-bg' : ''}`}>
        <div className="bg-grid" /><div className="bg-mesh" />
      </div>

      <AnimatePresence>
        {selectedProject && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProject(null)}>
            <motion.div className="glass-card modal-card" initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedProject(null)}><X size={24} /></button>     
              <div className="modal-image-container">
                {selectedProject.imageUrl ? <img src={selectedProject.imageUrl} alt={selectedProject.title} className="project-photo" loading="lazy" /> : <div className="image-placeholder"><Settings size={80} className="placeholder-icon" /></div>}
                <span className="dept-tag">{selectedProject.instructor}</span>
              </div>
              <div className="modal-content">
                <h2>{selectedProject.title}</h2>
                <div className="modal-footer">
                  <div className="modal-team-info"><Users size={20} /><span>{t[lang].team_members}: {selectedProject.team_members}</span></div>
                  <div className="modal-actions">
                    <button className="share-btn-elite" onClick={(e) => handleShare(e, selectedProject)}><Share2 size={20} /><span>{t[lang].share_team}</span></button>
                    {!archiveMode && (
                        <button onClick={(e) => { e.stopPropagation(); handleVote(selectedProject.id); }} disabled={!isVotingOpen || voterData.voteCount >= 3 || voterData.votedProjectIds.includes(selectedProject.id) || votingId === selectedProject.id} className="htu-button">
                            {votingId === selectedProject.id ? <Loader2 className="animate-spin" size={20} /> : voterData.votedProjectIds.includes(selectedProject.id) ? t[lang].voted : t[lang].cast_vote}
                        </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {lightboxImage && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightboxImage(null)}>
                <button className="modal-close" onClick={() => setLightboxImage(null)}><X size={24} /></button>     
                <img src={lightboxImage} alt="Full Size" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} />
            </motion.div>
        )}

        {showBadge && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnimatePresence mode="wait">
                    {!isNameSubmitted ? (
                        <motion.div key="name-input" className="glass-card name-input-card" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                            <Trophy size={60} color="#FFD700" className="mb-4" />
                            <h2>{t[lang].achievement}</h2>
                            <p className="subtitle">{t[lang].achievement_sub}</p>
                            <div className="elite-form">
                                <div className="input-group-elite">
                                    <label>{t[lang].display_name}</label>
                                    <input type="text" placeholder={t[lang].placeholder_name} value={voterName} onChange={(e) => setVoterName(e.target.value)} className="search-input" autoFocus />
                                </div>
                            </div>
                            <button className="htu-button w-full mt-4" disabled={!voterName.trim()} onClick={handleGenerateCertificate}>{t[lang].generate}</button>
                        </motion.div>
                    ) : (
                        <motion.div key="badge-display" className="glass-card badge-modal-card-elite" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <div className="badge-scroll-container">
                                {isGenerating ? <Loader2 className="animate-spin" size={60} /> : certImage && <img src={certImage} className="generated-cert-preview" style={{ width: '100%', borderRadius: '16px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />}
                            </div>
                            <div className="badge-actions-elite">
                                <button className="htu-button w-full" onClick={downloadBadge} disabled={isGenerating || !certImage}><Download size={20} /> {t[lang].download}</button>
                                <button className="htu-button outline-btn w-full" onClick={() => { setShowBadge(false); setIsNameSubmitted(false); setCertImage(null); }}>{t[lang].close}</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        )}

        {showOnboarding && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="glass-card onboarding-card">
                    <div className="lang-toggle-container mb-6" style={{ margin: '0 auto 30px', background: 'rgba(255,255,255,0.05)' }}>
                        <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
                        <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>العربية</button>
                    </div>
                    <Sparkles size={48} color="#E8343F" className="mb-4" />
                    <h2>{t[lang].welcome}</h2>
                    <p className="subtitle">{t[lang].welcome_sub}</p>
                    <div className="feature-list-onboarding">
                        <div className="f-item"><div className="f-dot"/><span>{t[lang].f1}</span></div>
                        <div className="f-item"><div className="f-dot"/><span>{t[lang].f2}</span></div>
                        <div className="f-item"><div className="f-dot"/><span>{t[lang].f3}</span></div>
                        <div className="f-item"><div className="f-dot"/><span>{t[lang].f4}</span></div>
                    </div>
                    <button className="htu-button w-full" onClick={closeOnboarding}>{t[lang].start}</button>    

                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <header className="main-header">
        <div className="lang-toggle-container">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>العربية</button>
        </div>

        <motion.div className="header-glass" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
          <motion.img initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src="favicon.png" alt="HTU Logo" className="htu-logo" onClick={handleLogoClick} />
          <motion.h1>{t[lang].title}</motion.h1>
          <motion.p className="subtitle">{t[lang].subtitle(3 - voterData.voteCount)}</motion.p>
          {globalVotes >= 0 && <div className="global-counter-pill"><span className="pulse-dot"></span><strong>{globalVotes.toLocaleString()}</strong> {t[lang].votes_cast}</div>}
          <div className="header-controls">
              <div className="vote-progress"><div className="vote-dots">{[1, 2, 3].map(i => (<motion.div key={i} className={`vote-dot ${i <= voterData.voteCount ? 'active' : ''}`} animate={i <= voterData.voteCount ? { scale: [1, 1.2, 1] } : {}} />))}</div></div>
          </div>
        </motion.div>
      </header>

      <main>
        <div className="tabs-container">
            <button className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>{t[lang].tab_projects}</button>
            <button className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}>{t[lang].tab_gallery}</button>
        </div>

        {activeTab === 'projects' ? (
            archiveMode ? (
                <section className="hall-of-fame-premium">
                    <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="hof-header-container">
                        <Award size={100} color="#FFD700" className="hof-award-icon" />
                        <h2 className="hof-main-title">HTU EXPO 2026 - OFFICIAL HALL OF FAME</h2>
                        <div className="hof-divider-glow" />
                        <p className="hof-subtitle">CELEBRATING THE PINNACLE OF ENGINEERING INNOVATION</p>
                    </motion.div>

                    <div className="hof-podium-container">
                        {/* 2nd Place */}
                        {hofProjects[1] && (
                            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, type: "spring", damping: 15 }} className="podium-item rank-2" onClick={() => setSelectedProject(hofProjects[1]!)}>
                                <div className="podium-rank-label white-text">2ND PLACE - SILVER</div>
                                <div className="podium-card-elite">
                                    <div className="podium-badge silver">JUDGING AWARD</div>
                                    <div className="podium-image-wrapper"><img src={hofProjects[1].imageUrl} alt="2nd" /></div>
                                    <div className="podium-info">
                                        <h3>{hofProjects[1].title}</h3>
                                        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>{hofProjects[1].team_members}</p>
                                    </div>
                                </div>
                                <div className="podium-base base-silver" />
                            </motion.div>
                        )}

                        {/* 1st Place */}
                        {hofProjects[0] && (
                            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: "spring", damping: 12 }} className="podium-item rank-1" onClick={() => setSelectedProject(hofProjects[0]!)}>
                                <div className="podium-rank-label white-text">1ST PLACE - GRAND CHAMPION</div>
                                <div className="podium-card-elite">
                                    <div className="podium-badge gold"><TrophyIcon size={18} /> JUDGING AWARD</div>   
                                    <div className="podium-image-wrapper gold-border"><img src={hofProjects[0].imageUrl} alt="1st" /></div>
                                    <div className="podium-info">
                                        <h3>{hofProjects[0].title}</h3>
                                        <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>{hofProjects[0].team_members}</p>
                                    </div>
                                </div>
                                <div className="podium-base base-gold" />
                            </motion.div>
                        )}

                        {/* 3rd Place */}
                        {hofProjects[2] && (
                            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, type: "spring", damping: 18 }} className="podium-item rank-3" onClick={() => setSelectedProject(hofProjects[2]!)}>
                                <div className="podium-rank-label white-text">3RD PLACE - BRONZE</div>
                                <div className="podium-card-elite">
                                    <div className="podium-badge bronze">JUDGING AWARD</div>
                                    <div className="podium-image-wrapper"><img src={hofProjects[2].imageUrl} alt="3rd" /></div>
                                    <div className="podium-info">
                                        <h3>{hofProjects[2].title}</h3>
                                        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>{hofProjects[2].team_members}</p>
                                    </div>
                                </div>
                                <div className="podium-base base-bronze" />
                            </motion.div>
                        )}
                    </div>

                    <div className="runners-up-section">
                        <div className="runners-up-header">
                            <div className="line" />
                            <span>SPECIAL RECOGNITIONS</span>
                            <div className="line" />
                        </div>
                        <div className="runners-up-grid">
                            {hofProjects[3] && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="runner-up-row glass-card" onClick={() => setSelectedProject(hofProjects[3]!)}>
                                    <div className="runner-rank">4TH</div>
                                    <div className="runner-title-group">
                                        <strong>{hofProjects[3].title}</strong>
                                        <span style={{ fontSize: '0.8rem', textTransform: 'none', letterSpacing: '0' }}>{hofProjects[3].team_members}</span>
                                    </div>
                                    <div className="runner-votes-badge" style={{ borderColor: '#FFD700', color: '#FFD700' }}>JUDGING AWARD</div>
                                </motion.div>
                            )}
                            {hofProjects[4] && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="runner-up-row glass-card" onClick={() => setSelectedProject(hofProjects[4]!)}>
                                    <div className="runner-rank">5TH</div>       
                                    <div className="runner-title-group">
                                        <strong>{hofProjects[4].title}</strong>
                                        <span style={{ fontSize: '0.8rem', textTransform: 'none', letterSpacing: '0' }}>{hofProjects[4].team_members}</span>
                                    </div>
                                    <div className="runner-votes-badge" style={{ borderColor: '#E8343F', color: '#E8343F', background: 'rgba(232, 52, 63, 0.1)' }}>FAN FAV AWARD</div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    <div className="runners-up-section" style={{ marginTop: '80px' }}>
                        <div className="runners-up-header">
                            <div className="line" />
                            <span>ALL PROJECTS</span>
                            <div className="line" />
                        </div>
                        <div className="grid-container" style={{ padding: '20px 0 0 0' }}>
                            {unrankedProjects.map((project, index) => (
                                <motion.div key={project.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} className="glass-card project-card" onClick={() => setSelectedProject(project)}>
                                <div className="project-image-container">{project.imageUrl ? <img src={project.imageUrl} alt={project.title} className="project-photo" loading="lazy" /> : <div className="image-placeholder"><Settings size={40} className="placeholder-icon" /></div>}<span className="dept-tag">{project.instructor}</span></div>
                                <div className="card-content"><h3>{project.title}</h3><div className="team-info"><Users size={16} /><span>{project.team_members}</span></div></div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            ) : (
                <section className="projects-section">
                    <div className="section-header">
                        <div className="gallery-title-wrapper"><h2>{t[lang].gallery}</h2><div className="title-underline"></div></div>
                        <div className="count-badge"><span className="count-number">{displayProjects.length}</span><span className="count-text">{t[lang].expo_count}</span></div>
                        <div className="search-container mt-4"><Search className="search-icon" size={20} /><input type="text" placeholder={t[lang].search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" /></div>
                    </div>
                    <div className="grid-container">
                        <AnimatePresence mode="popLayout">
                        {displayProjects.map((project, index) => (
                            <motion.div key={project.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.05 }} className="glass-card project-card" onClick={() => setSelectedProject(project)}>
                            {voterData.votedProjectIds.includes(project.id) && <div className="voted-overlay"><CheckCircle2 size={24} /></div>}
                            <div className="project-image-container">{project.imageUrl ? <img src={project.imageUrl} alt={project.title} className="project-photo" loading="lazy" /> : <div className="image-placeholder"><Settings size={40} className="placeholder-icon" /></div>}<span className="dept-tag">{project.instructor}</span></div>
                            <div className="card-content"><h3>{project.title}</h3><div className="team-info"><Users size={16} /><span>{project.team_members}</span></div></div>
                            <div className="card-footer">
                                <button onClick={(e) => { e.stopPropagation(); handleVote(project.id); }} disabled={!isVotingOpen || voterData.voteCount >= 3 || voterData.votedProjectIds.includes(project.id) || votingId === project.id} className="htu-button">
                                {votingId === project.id ? <Loader2 className="animate-spin" size={20} /> : voterData.votedProjectIds.includes(project.id) ? t[lang].voted : t[lang].vote}
                                </button>
                            </div>
                            </motion.div>
                        ))}
                        </AnimatePresence>
                    </div>
                </section>
            )
        ) : (
            <section className="projects-section">
                <div className="section-header">
                    <div className="gallery-title-wrapper"><h2>{t[lang].tab_gallery}</h2><div className="title-underline"></div></div>
                </div>
                <div className="gallery-masonry">
                    <AnimatePresence mode="popLayout">
                    {galleryImages.map((img, index) => (
                        <motion.div
                            key={img.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="gallery-item"
                            onClick={() => setLightboxImage(img.imageUrl)}
                        >
                            <img src={img.imageUrl} alt="Live Event" loading="lazy" />
                        </motion.div>
                    ))}
                    </AnimatePresence>
                    {galleryImages.length === 0 && (
                        <p style={{ textAlign: 'center', width: '100%', opacity: 0.5, gridColumn: '1 / -1' }}>No photos uploaded yet.</p>
                    )}
                </div>
            </section>
        )}
      </main>

      <div className="floating-info-btn" onClick={() => setShowOnboarding(true)}><Info size={24} /></div>
      <div className="admin-access-hint" onClick={() => setView('admin')}><Settings size={16} /> {t[lang].org_login}</div>

      <footer>
        <p>&copy; 2026 Al-Hussein Technical University. All Rights Reserved.</p>
        <p className="credits">Made and Engineered by NAJDAWI</p>
      </footer>
    </div>
  );
}

export default App;
