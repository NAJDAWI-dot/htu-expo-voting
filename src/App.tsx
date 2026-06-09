import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Users, Award, Search, Trophy, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  runTransaction, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import './App.css';

interface Project {
  id: string;
  title: string;
  description: string;
  department: string;
  team_members: string;
  votes: number;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [voterData, setVoterData] = useState<{ voteCount: number; votedProjectIds: string[] }>({
    voteCount: 0,
    votedProjectIds: []
  });
  const [initialSplash, setInitialSplash] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Authenticate Anonymously
    signInAnonymously(auth).catch(console.error);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        // 2. Real-time Voter Status
        const voterRef = doc(db, 'voters', user.uid);
        return onSnapshot(voterRef, (doc) => {
          if (doc.exists()) {
            setVoterData(doc.data() as any);
          }
        });
      }
    });

    // 3. Real-time Projects Feed
    const projectsQuery = query(collection(db, 'projects'), orderBy('title', 'asc'));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsList);
      
      // Artificially end splash after first data load
      setTimeout(() => setInitialSplash(false), 2500);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProjects();
    };
  }, []);

  const handleVote = async (projectId: string) => {
    if (!userId || voterData.voteCount >= 3) return;
    if (voterData.votedProjectIds.includes(projectId)) return;

    setVotingId(projectId);
    try {
      const voterRef = doc(db, 'voters', userId);
      const projectRef = doc(db, 'projects', projectId);

      await runTransaction(db, async (transaction) => {
        const voterDoc = await transaction.get(voterRef);
        const projectDoc = await transaction.get(projectRef);

        if (!projectDoc.exists()) throw "Project does not exist!";

        const currentVoterData = voterDoc.exists() 
          ? voterDoc.data() 
          : { voteCount: 0, votedProjectIds: [] };

        if (currentVoterData.voteCount >= 3) throw "Vote limit reached!";
        if (currentVoterData.votedProjectIds.includes(projectId)) throw "Already voted for this!";

        // Update Voter
        transaction.set(voterRef, {
          voteCount: currentVoterData.voteCount + 1,
          votedProjectIds: [...currentVoterData.votedProjectIds, projectId]
        }, { merge: true });

        // Update Project
        transaction.update(projectRef, {
          votes: (projectDoc.data().votes || 0) + 1
        });
      });

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#E8343F', '#FFFFFF', '#020B18', '#FFD700']
      });

    } catch (error: any) {
      alert(error || 'Failed to vote');
    } finally {
      setVotingId(null);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.team_members.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const leaderboard = [...projects].sort((a, b) => b.votes - a.votes).slice(0, 5);

  if (initialSplash) {
    return (
      <motion.div 
        className="splash-screen"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="splash-content">
          <motion.img 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            src="/favicon.png" 
            alt="HTU Logo" 
            className="splash-logo"
          />
          <motion.div 
            className="splash-loader"
            initial={{ width: 0 }}
            animate={{ width: '200px' }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          <p className="splash-text">Engineering Design Expo 2026</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="app-container">
      <div className="animated-bg" />
      
      <header>
        <motion.img 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          src="/favicon.png" 
          alt="HTU Logo" 
          className="htu-logo"
        />
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Engineering Design Expo
        </motion.h1>
        <motion.p 
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Choose your Fan Favorite projects. You have <b>{3 - voterData.voteCount}</b> votes remaining.
        </motion.p>
        
        <div className="header-controls">
            <div className="vote-progress">
                <div className="vote-dots">
                    {[1, 2, 3].map(i => (
                        <motion.div 
                            key={i}
                            className={`vote-dot ${i <= voterData.voteCount ? 'active' : ''}`}
                            animate={i <= voterData.voteCount ? { scale: [1, 1.2, 1] } : {}}
                        />
                    ))}
                </div>
            </div>

            <div className="search-container">
                <Search className="search-icon" size={20} />
                <input 
                    type="text" 
                    placeholder="Search projects, contestants, or departments..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>
        </div>
      </header>

      <main>
        <section className="projects-section">
            <div className="section-header">
                <h2>Project Gallery</h2>
                <span className="count-badge">{filteredProjects.length} Projects</span>
            </div>
            
            <div className="grid-container">
                <AnimatePresence mode="popLayout">
                {filteredProjects.map((project, index) => (
                    <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass-card project-card"
                    >
                    {voterData.votedProjectIds.includes(project.id) && (
                        <div className="voted-overlay">
                        <CheckCircle2 size={24} />
                        </div>
                    )}
                    
                    <div className="card-header">
                        <span className="vote-badge">{project.department}</span>
                        <h3>{project.title}</h3>
                    </div>
                    
                    <p className="description">{project.description}</p>
                    
                    <div className="team-info">
                        <Users size={16} />
                        <span>{project.team_members}</span>
                    </div>

                    <div className="card-footer">
                        <div className="vote-stats">
                            <Award size={18} color="#E8343F" />
                            <span>{project.votes} votes</span>
                        </div>
                        
                        <button
                        onClick={() => handleVote(project.id)}
                        disabled={
                            voterData.voteCount >= 3 || 
                            voterData.votedProjectIds.includes(project.id) ||
                            votingId === project.id
                        }
                        className="htu-button"
                        >
                        {votingId === project.id ? <Loader2 className="animate-spin" size={20} /> : 
                        voterData.votedProjectIds.includes(project.id) ? 'Voted' : 'Vote'}
                        </button>
                    </div>
                    </motion.div>
                ))}
                </AnimatePresence>
            </div>
        </section>

        <section className="leaderboard-section">
            <div className="glass-card leaderboard-card">
                <div className="leaderboard-header">
                    <Trophy className="trophy-icon" size={32} />
                    <h2>Live Leaderboard</h2>
                </div>
                <div className="leaderboard-list">
                    {leaderboard.map((project, index) => (
                        <motion.div 
                            key={project.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="leaderboard-item"
                        >
                            <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                            <div className="item-info">
                                <h4>{project.title}</h4>
                                <p>{project.department}</p>
                            </div>
                            <div className="item-votes">
                                <strong>{project.votes}</strong>
                                <span>votes</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      <footer>
        <p>&copy; 2026 Al-Hussein Technical University. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default App;
