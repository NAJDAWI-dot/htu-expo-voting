import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { CheckCircle2, Users, Search, Loader2, Settings, X, Share2, Info, Download, Trophy, Sparkles, Trophy as TrophyIcon, Volume2, ShieldCheck } from 'lucide-react';
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
  const [audioReady, setAudioReady] = useState(false);

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
  const [kioskCycleIndex, setKioskCycleIndex] = useState(0); // 0=Leaderboard, 1=Gallery, 2=Branding
  
  const [showBadge, setShowBadge] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [voterName, setVoterName] = useState('');
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [certImage, setCertImage] = useState<string | null>(null);

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
      ceremony_1: "3RD PLACE WINNER",
      ceremony_2: "2ND PLACE WINNER",
      ceremony_3: "GRAND CHAMPION 2026",
      kiosk_live: "LIVE LEADERBOARD",
      kiosk_gallery: "EVENT PHOTO STREAM",
      credit_0_title: "Special Thanks To",
      credit_0_main: "Al-Hussein Technical University",
      credit_1_title: "Under The Patronage of",
      credit_1_main: "HTU Presidency",
      credit_2_title: "Dedicated To Our",
      credit_2_main: "Instructors & Students",
      credit_3_title: "Engineered By",
      credit_3_main: "The Expo Organizers",
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
      ceremony_1: "المركز الثالث",
      ceremony_2: "المركز الثاني",
      ceremony_3: "البطل الأول 2026",
      kiosk_live: "لوحة النتائج المباشرة",
      kiosk_gallery: "بث صور المعرض",
      credit_0_title: "شكر خاص إلى",
      credit_0_main: "جامعة الحسين التقنية",
      credit_1_title: "تحت رعاية",
      credit_1_main: "رئاسة الجامعة",
      credit_2_title: "إهداء إلى",
      credit_2_main: "المشرفين والطلبة",
      credit_3_title: "تصميم وبرمجة",
      credit_3_main: "منظمي المعرض",
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
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        if (!user.email?.includes('@htu.local')) {
          const voterRef = doc(db, 'voters', user.uid);
          unsubscribeVoter = onSnapshot(voterRef, (doc) => { if (doc.exists()) setVoterData(doc.data() as any); });
        }
      } else {
        setUserId(null); setVoterData({ voteCount: 0, votedProjectIds: [] }); unsubscribeVoter();
      }
    });

    const projectsQuery = query(collection(db, 'projects'), orderBy('title', 'asc'));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
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
    const unsubscribeGallery = onSnapshot(galleryQuery, (snapshot) => {
      setGalleryImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GalleryImage[]);
    });

    const unsubStats = onSnapshot(doc(db, 'stats', 'global'), (doc) => { if (doc.exists()) setGlobalVotes(doc.data().total || 0); });
    
    const unsubConfig = onSnapshot(doc(db, 'config', 'voting'), (doc) => { 
        if (doc.exists()) {
            setIsVotingOpen(doc.data().isOpen);
            setArchiveMode(doc.data().archiveMode || false);
        }
    });

    const unsubKiosk = onSnapshot(doc(db, 'config', 'kiosk'), (doc) => { 
        if (doc.exists()) {
            const data = doc.data() as any;
            setKioskConfig(prev => ({ ...prev, ...data }));
        }
    });

    return () => { unsubscribeAuth(); unsubscribeProjects(); unsubscribeVoter(); unsubStats(); unsubConfig(); unsubscribeGallery(); unsubKiosk(); };
  }, [view]);

  // Dedicated Audio Sync Engine
  useEffect(() => {
    if (view === 'kiosk' && audioReady) {
        const sounds = ['drumroll', 'heartbeat', 'applause', 'swoosh'];
        sounds.forEach(s => {
            const el = document.getElementById(`audio-${s}`) as HTMLAudioElement;
            if (el) {
                if (kioskConfig.activeAudio === s && kioskConfig.audioStatus === 'playing') {
                    if (el.paused) {
                        el.currentTime = 0;
                        el.play().catch(e => console.log("Play blocked", e));
                    }
                } else {
                    el.pause();
                    if (kioskConfig.audioStatus === 'stopped') el.currentTime = 0;
                }
            }
        });
    }
  }, [view, audioReady, kioskConfig.activeAudio, kioskConfig.audioStatus]);

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
    const prevData = { ...voterData };
    setVoterData(prev => ({ voteCount: prev.voteCount + 1, votedProjectIds: [...prev.votedProjectIds, projectId] }));
    setVotingId(projectId);
    try {
      const voterRef = doc(db, 'voters', userId);
      const resultRef = doc(db, 'results', projectId);
      const statsRef = doc(db, 'stats', 'global');
      await runTransaction(db, async (transaction) => {
        const voterSnap = await transaction.get(voterRef);
        const currentVoterData = voterSnap.exists() ? voterSnap.data() : { voteCount: 0, votedProjectIds: [] };
        if (currentVoterData.voteCount >= 3 || currentVoterData.votedProjectIds.includes(projectId)) throw "LIMIT_REACHED";
        const voteWeight = 3 - currentVoterData.voteCount;
        transaction.set(voterRef, { voteCount: currentVoterData.voteCount + 1, votedProjectIds: [...currentVoterData.votedProjectIds, projectId] }, { merge: true });
        transaction.set(resultRef, { votes: increment(voteWeight) }, { merge: true });
        transaction.set(statsRef, { total: increment(1) }, { merge: true });
      });
      const isMobile = window.innerWidth <= 768;
      confetti({ particleCount: isMobile ? 50 : 150, spread: isMobile ? 50 : 80, origin: { y: 0.6 }, colors: ['#E8343F', '#FFFFFF', '#020B18', '#FFD700'] });
    } catch (error: any) { setVoterData(prevData); if (error !== "LIMIT_REACHED") console.error('Voting Error:', error); } finally { setVotingId(null); }
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
    const topProjects = [...projects].sort((a,b) => ( (a as any).votes || 0 ) - ( (b as any).votes || 0 )).reverse();
    const top3 = topProjects.slice(0, 3);
    const top10 = topProjects.slice(0, 10);
    const currentSubView = kioskCycleIndex === 0 ? 'leaderboard' : kioskCycleIndex === 1 ? 'gallery' : 'branding';
    
    return (
        <div className={`kiosk-mode ${kioskConfig.revealStep === 8 ? 'champion-active' : ''}`}>
            {!audioReady && (
                <motion.div className="audio-gate-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="glass-card gate-card">
                        <Volume2 size={60} color="#E8343F" />
                        <h2>Enable Kiosk Audio</h2>
                        <p>Browser security requires a manual click to activate the soundboard engine.</p>
                        <button className="htu-button w-full" onClick={() => setAudioReady(true)}>Sync Audio & Visuals</button>
                    </div>
                </motion.div>
            )}

            {/* Audio Elements for Soundboard */}
            <audio id="audio-drumroll" src="https://www.soundjay.com/misc/drum-roll-01.mp3" preload="auto" loop />
            <audio id="audio-heartbeat" src="https://www.soundjay.com/human/heartbeat-01.mp3" preload="auto" loop />
            <audio id="audio-applause" src="https://www.soundjay.com/human/applause-01.mp3" preload="auto" />
            <audio id="audio-swoosh" src="https://assets.mixkit.co/active_storage/sfx/2034/2034-preview.mp3" preload="auto" />

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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="victory-reveal-overlay">
                        <div className="ceremony-bg">
                            <div className="spotlight" />
                            {kioskConfig.revealStep === 8 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }} className="victory-confetti" />}
                        </div>

                        <div className="ceremony-content-premium">
                            {!kioskConfig.isPaused && kioskConfig.revealStep >= 6 && (
                                <motion.h2 key={kioskConfig.revealStep} initial={{ y: -50, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="ceremony-title">
                                    {t[lang][`ceremony_step_${kioskConfig.revealStep}` as keyof typeof t['en']] as string}
                                </motion.h2>
                            )}
                            
                            <div className="reveal-stage-premium">
                                {!kioskConfig.isPaused && kioskConfig.revealStep >= 6 && (
                                    <motion.div 
                                        key={`card-${kioskConfig.revealStep}`}
                                        initial={{ scale: 0.1, opacity: 0, rotateX: 90, y: 500 }} 
                                        animate={{ scale: 1, opacity: 1, rotateX: 0, y: 0 }} 
                                        exit={{ scale: 1.5, opacity: 0, filter: 'blur(20px)' }}
                                        transition={{ type: "spring", damping: 12, stiffness: 60, duration: 2 }}
                                        className={`winner-card-premium card-rank-${9 - kioskConfig.revealStep}`}
                                    >
                                        <div className="winner-rank-badge">#{9 - kioskConfig.revealStep}</div>
                                        <div className="winner-main-premium">
                                            {top3[8 - kioskConfig.revealStep] && (
                                                <>
                                                    <motion.div 
                                                        initial={{ x: -200, opacity: 0, filter: 'blur(30px)' }}
                                                        animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
                                                        transition={{ delay: 2.0, type: "spring", damping: 15 }}
                                                        className="winner-photo-container-premium"
                                                    >
                                                        {top3[8 - kioskConfig.revealStep].imageUrl ? <img src={top3[8 - kioskConfig.revealStep].imageUrl} alt="W" /> : <TrophyIcon size={120} />}
                                                    </motion.div>
                                                    <motion.div 
                                                        initial={{ x: 200, opacity: 0, filter: 'blur(30px)' }}
                                                        animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
                                                        transition={{ delay: 3.0, type: "spring", damping: 15 }}
                                                        className="winner-details-premium"
                                                    >
                                                        <h3 className="winner-team-premium">{top3[8 - kioskConfig.revealStep].title}</h3>
                                                        <p className="winner-instructor-premium">{top3[8 - kioskConfig.revealStep].instructor}</p>
                                                        {!kioskConfig.hideResults && (
                                                            <motion.div 
                                                                initial={{ scale: 0, rotate: -15, filter: 'brightness(5)' }} 
                                                                animate={{ scale: [0, 1.5, 1], rotate: 0, filter: 'brightness(1)' }} 
                                                                transition={{ delay: 5.0, type: "spring", stiffness: 300, damping: 10 }} 
                                                                className="winner-votes-premium"
                                                            >
                                                                { (top3[8 - kioskConfig.revealStep] as any).votes } <span className="votes-label">VOTES</span>
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {!kioskConfig.isPaused && kioskConfig.revealStep >= 1 && kioskConfig.revealStep <= 5 && (
                                    <motion.div 
                                        key={`credit-${kioskConfig.revealStep}`}
                                        initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
                                        transition={{ duration: 1.5, ease: "easeInOut" }}
                                        className="credits-slide"
                                    >
                                        <span className="credits-title">{t[lang][`ceremony_step_${kioskConfig.revealStep}` as keyof typeof t['en']] as string}</span>
                                        {kioskConfig.revealStep === 5 ? (
                                            <div className="org-credits-container" style={{ marginTop: '20px' }}>
                                                {kioskConfig.headOrganizerNames && (
                                                    <div className="head-org-section">
                                                        <h4 style={{ color: '#E8343F', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '10px' }}>Head Organizers</h4>
                                                        <strong className="credits-main head-org-names" style={{ fontSize: '3.5rem' }}>{kioskConfig.headOrganizerNames}</strong>
                                                    </div>
                                                )}
                                                {kioskConfig.organizerNames && (
                                                    <div className="general-org-section" style={{ marginTop: '30px' }}>
                                                        <h4 style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', fontSize: '1rem' }}>Organizers</h4>
                                                        <strong className="credits-main general-org-names" style={{ fontSize: '2rem', color: '#ccc', textShadow: 'none' }}>{kioskConfig.organizerNames}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <strong className="credits-main">{t[lang][`credit_${kioskConfig.revealStep - 1}_main` as keyof typeof t['en']] as string}</strong>
                                        )}
                                        <div className="credits-divider" />
                                    </motion.div>
                                )}
                                
                                {(!kioskConfig.isPaused && kioskConfig.revealStep === 0) || kioskConfig.isPaused ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ceremony-intro splash-content">
                                        <div className="logo-container-premium" style={{ transform: 'scale(1.5)', marginBottom: '50px' }}>
                                            <div className="splash-ring ring-1" />
                                            <div className="splash-ring ring-2" />
                                            <div className="splash-ring ring-3" />
                                            <motion.img 
                                                initial={{ scale: 0.8, opacity: 0 }} 
                                                animate={{ scale: 1, opacity: 1 }} 
                                                transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
                                                src="favicon.png" 
                                                alt="HTU Logo" 
                                                className="splash-logo" 
                                            />
                                        </div>
                                        <div className="splash-loader-container" style={{ width: '500px', height: '6px', background: 'rgba(255,255,255,0.1)' }}>
                                            <motion.div className="splash-loader" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 4, repeat: Infinity }} />
                                        </div>
                                        <motion.div 
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ repeat: Infinity, duration: 2, repeatType: 'reverse' }}
                                            className="intro-pulse-text" style={{ marginTop: '30px', letterSpacing: '20px', fontSize: '3rem' }}
                                        >
                                            {t[lang].ceremony_0}
                                        </motion.div>
                                    </motion.div>
                                ) : null}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="kiosk-content-area">
                <AnimatePresence mode="wait">
                    {currentSubView === 'leaderboard' && (
                        <motion.div key="lead" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="kiosk-sub-view">
                            <div className="kiosk-header">
                                <img src="favicon.png" alt="Logo" className="kiosk-logo" />
                                <h1>{t[lang].kiosk_live}</h1>
                                <div className="global-counter-pill"><span className="pulse-dot"></span><strong>{globalVotes.toLocaleString()}</strong> TOTAL VOTES</div>
                            </div>
                            <div className="kiosk-list">
                                {top10.map((p, i) => (
                                    <motion.div key={p.id} layout className={`kiosk-item glass-card ${kioskConfig.hideResults ? 'masked' : ''}`}>
                                        <span className={`rank rank-${i+1}`}>{i+1}</span>
                                        <div className="item-main">
                                            <h3 className={kioskConfig.hideResults ? 'glitch-mask' : ''}>{p.title}</h3>
                                            <p className={kioskConfig.hideResults ? 'glitch-mask' : ''}>{p.instructor}</p>
                                        </div>
                                        <div className="item-bar-container">
                                            <motion.div className={`item-bar ${kioskConfig.hideResults ? 'glitch-mask' : ''}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((p as any).votes / (top10[0] as any).votes) * 100)}%` }} transition={{ duration: 1 }} />
                                            <span className={`item-votes-count ${kioskConfig.hideResults ? 'glitch-mask' : ''}`}>{(p as any).votes}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {currentSubView === 'gallery' && (
                        <motion.div key="gal" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="kiosk-sub-view">
                            <div className="kiosk-header"><h1>{t[lang].kiosk_gallery}</h1></div>
                            <div className="gallery-masonry kiosk-gallery-masonry">
                                {galleryImages.slice(0, 12).map((img, index) => (
                                    <motion.div key={img.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="gallery-item">
                                        <img src={img.imageUrl} alt="Event" />
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {currentSubView === 'branding' && (
                        <motion.div key="brand" initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }} className="kiosk-sub-view kiosk-branding-view">
                            <div className="logo-container-premium" style={{ width: '450px', height: '450px' }}>
                                <div className="splash-ring ring-1" style={{ width: '450px', height: '450px' }} />
                                <div className="splash-ring ring-2" style={{ width: '400px', height: '400px' }} />
                                <img src="favicon.png" alt="HTU" className="intro-logo" style={{ height: '300px' }} />
                            </div>
                            <h2 className="splash-branding-top" style={{ position: 'static', transform: 'none', fontSize: '5rem', marginTop: '40px' }}>REIMAGINING HTU EXPOs</h2>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

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
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card archive-admin-card">
                <ShieldCheck size={64} color="#FFD700" className="mb-6" />
                <h1>Archive Control Center</h1>
                <p>Remotely toggle the HTU Expo 2026 Hall of Fame mode.</p>
                <div className={`archive-status-indicator ${archiveMode ? 'active' : 'idle'}`}>
                    {archiveMode ? 'SYSTEM ARCHIVED' : 'SYSTEM LIVE'}
                </div>
                <button 
                    className={`htu-button w-full ${archiveMode ? 'outline-btn' : ''}`} 
                    onClick={async () => {
                        const confirmation = window.confirm("Toggle Archive Mode? This will lock/unlock public voting.");
                        if (confirmation) {
                            const votingRef = doc(db, 'config', 'voting');
                            await setDoc(votingRef, { archiveMode: !archiveMode, isOpen: archiveMode }, { merge: true });
                        }
                    }}
                >
                    {archiveMode ? 'Disable Archive Mode' : 'ACTIVATE HALL OF FAME'}
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
      <div className="background-wrapper">
        <div className="bg-grid" /><div className="bg-mesh" />
        <div className="floating-orbs">
          <div className="orb" style={{ width: '600px', height: '600px', top: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(232, 52, 63, 0.15) 0%, transparent 70%)', animationDelay: '0s' }}></div>
          <div className="orb" style={{ width: '800px', height: '800px', bottom: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(10, 25, 47, 0.5) 0%, transparent 70%)', animationDelay: '-5s' }}></div>
        </div>
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
            <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>AR</button>
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
            <section className="projects-section">
                <div className="section-header">
                    <div className="gallery-title-wrapper"><h2>{t[lang].gallery}</h2><div className="title-underline"></div></div>
                    <div className="count-badge"><span className="count-number">{displayProjects.length}</span><span className="count-text">{t[lang].expo_count}</span></div>
                    <div className="search-container mt-4"><Search className="search-icon" size={20} /><input type="text" placeholder={t[lang].search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" /></div>
                </div>
                <div className="grid-container">
                    <AnimatePresence mode="popLayout">
                    {displayProjects.map((project, index) => (
                        <motion.div key={project.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.05 }} className={`glass-card project-card ${archiveMode ? 'archived' : ''}`} onClick={() => setSelectedProject(project)}>
                        {voterData.votedProjectIds.includes(project.id) && <div className="voted-overlay"><CheckCircle2 size={24} /></div>}
                        <div className="project-image-container">{project.imageUrl ? <img src={project.imageUrl} alt={project.title} className="project-photo" loading="lazy" /> : <div className="image-placeholder"><Settings size={40} className="placeholder-icon" /></div>}<span className="dept-tag">{project.instructor}</span></div>
                        <div className="card-content"><h3>{project.title}</h3><div className="team-info"><Users size={16} /><span>{project.team_members}</span></div></div>
                        <div className="card-footer">
                            {archiveMode ? (
                                <div className="winner-votes-premium" style={{ fontSize: '1.2rem', padding: '10px 20px', borderRadius: '12px' }}>
                                    {(project as any).finalVotes || 0} <span className="votes-label">VOTES</span>
                                </div>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleVote(project.id); }} disabled={!isVotingOpen || voterData.voteCount >= 3 || voterData.votedProjectIds.includes(project.id) || votingId === project.id} className="htu-button">
                                {votingId === project.id ? <Loader2 className="animate-spin" size={20} /> : voterData.votedProjectIds.includes(project.id) ? t[lang].voted : t[lang].vote}
                                </button>
                            )}
                        </div>
                        </motion.div>
                    ))}
                    </AnimatePresence>
                </div>
            </section>
        ) : (
            <section className="projects-section">
                <div className="section-header">
                    <div className="gallery-title-wrapper"><h2>{t[lang].tab_gallery}</h2><div className="title-underline"></div></div>
                </div>
                <div className="gallery-masonry kiosk-gallery-masonry">
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
