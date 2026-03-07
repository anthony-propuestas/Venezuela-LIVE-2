import Login, { LoginBypass, getStoredAuth, clearAuth, AUTH_PAUSED } from './login';
import Profile from './Profile';
import { useError } from '@client/context/ErrorContext';
import * as api from './api';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  PlusCircle,
  ShieldAlert,
  Shield,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  BarChart3,
  Menu,
  Settings,
  Heart,
  Users,
  ArrowLeft,
  FolderPlus,
  User,
  Calendar,
  Mail,
  Tag,
  Plus,
  LogOut,
  Crown,
  Copy,
  Check
} from 'lucide-react';

// --- FUNCIONES DE TEMPORIZADOR SEMANAL ---
// Semana de votación: Lunes 00:00 - Domingo 23:59. Tras el domingo (corte PDF), el lunes inicia nueva semana.
const getNextSundayReset = () => {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);
  return nextSunday;
};

/** Retorna el inicio de la semana actual (lunes 00:00:00). Si es domingo, es el lunes de esta semana. */
const getStartOfCurrentWeek = () => {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7; // 0=Dom->6, 1=Lun->0, 2=Mar->1...
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const canVoteThisWeek = (lastVoteTime) => {
  if (!lastVoteTime) return true;
  const startOfWeek = getStartOfCurrentWeek();
  return new Date(lastVoteTime) < startOfWeek;
};

const formatTimeRemaining = (targetDate) => {
  const now = new Date();
  const diff = targetDate - now;
  if (diff <= 0) return 'Reinicio disponible';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// --- DATOS SIMULADOS (MOCK DATA) ---
const CATEGORY_TREE = [
  { name: 'Economía', subcategories: ['Moneda', 'Inflación', 'Impuestos'] },
  { name: 'Salud', subcategories: ['Infraestructura', 'Personal Médico', 'Insumos'] },
  { name: 'Seguridad', subcategories: ['Prevención', 'Cárceles', 'Policía'] },
  { name: 'Educación', subcategories: ['Docentes', 'Infraestructura', 'Currículo'] },
  { name: 'Servicios Públicos', subcategories: ['Electricidad', 'Agua', 'Internet', 'Transporte'] }
];

/** Páginas válidas para navegación (evita estados inválidos al volver del menú). */
const VALID_PAGES = ['home', 'general', 'perfil', 'donations', 'nosotros', 'premium'];

const INITIAL_THREADS = [
  {
    id: 't1',
    category: 'Educación',
    subcategory: 'Docentes',
    topic: '¿Cómo recuperar el salario de los docentes universitarios y de educación media?',
    proposals: [
      {
        id: 'p1',
        title: 'Indexación al valor de la canasta básica',
        description: 'Indexar el salario al valor de la canasta básica familiar mediante un fondo mixto financiado por exportaciones petroleras y un nuevo impuesto a transacciones en divisas.',
        author: 'EconoVen',
        upvotes: 1250,
        downvotes: 150,
        netScore: 1100,
        comments: [
          { id: 'c1', text: 'Totalmente de acuerdo. La canasta básica es la única métrica realista hoy en día.', position: 'favor' },
          { id: 'c2', text: 'El impuesto a divisas va a destruir el comercio local.', position: 'contra' }
        ],
        notes: [
          { id: 'n1', text: 'Nota: Un impuesto a transacciones en divisas aumentaría la inflación de los productos importados básicos.', netScore: 45 }
        ]
      },
      {
        id: 'p2',
        title: 'Privatización parcial del sistema',
        description: 'Privatizar parcialmente el sistema universitario y usar los fondos ahorrados para subsidiar directamente el sueldo de los profesores de educación media.',
        author: 'Libertad99',
        upvotes: 400,
        downvotes: 800,
        netScore: -400,
        notes: []
      },
      {
        id: 'p3',
        title: 'Salario base anclado a aduanas',
        description: 'Establecer un salario base de $300 anclado a la recaudación aduanera, eliminando bonos sin incidencia salarial.',
        author: 'ProfeGremial',
        upvotes: 1050,
        downvotes: 50,
        netScore: 1000,
        notes: []
      }
    ]
  },
  {
    id: 't2',
    category: 'Economía',
    subcategory: 'Moneda',
    topic: 'Reestructuración de la Moneda Nacional',
    proposals: [
      {
        id: 'p4',
        title: 'Dolarización oficial',
        description: 'Dolarización oficial y definitiva de la economía para detener la devaluación y generar confianza en inversores extranjeros.',
        author: 'CapitalLibre',
        upvotes: 5000,
        downvotes: 4950,
        netScore: 50,
        notes: [
          { id: 'n2', text: 'Nota: La dolarización oficial requiere un acuerdo con la Reserva Federal de EE.UU. que actualmente es inviable por sanciones.', netScore: 800 }
        ]
      }
    ]
  },
  {
    id: 't3',
    category: 'Servicios Públicos',
    subcategory: 'Electricidad',
    topic: 'Solución a la crisis eléctrica (SEN)',
    proposals: [
      {
        id: 'p6',
        title: 'Micro-redes solares comunitarias',
        description: 'Descentralizar el sistema eléctrico promoviendo micro-redes solares comunitarias subsidiadas en las regiones más afectadas como Zulia y Los Andes.',
        author: 'EcoZulia',
        upvotes: 850,
        downvotes: 50,
        netScore: 800,
        notes: []
      }
    ]
  }
];

export default function App() {
  const [estaAutenticado, setEstaAutenticado] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();
    setEstaAutenticado(!!stored);
    setAuthChecked(true);
  }, []);
  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [activeSubcategory, setActiveSubcategory] = useState(null);
  const [filterMode, setFilterMode] = useState('cielo');
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTopicCategory, setNewTopicCategory] = useState(CATEGORY_TREE[0].name);
  const [newTopicSubcategory, setNewTopicSubcategory] = useState(CATEGORY_TREE[0].subcategories[0]);
  const [newTopicName, setNewTopicName] = useState('');
  const [newProposalTitle, setNewProposalTitle] = useState('');
  const [newProposalDesc, setNewProposalDesc] = useState('');
  const [newProposalAuthor, setNewProposalAuthor] = useState('');

  // Estado para votos del usuario (1 like O 1 dislike por propuesta, reinicio semanal)
  const [userVotes, setUserVotes] = useState(() => {
    const saved = localStorage.getItem('venezuelaLiveVotes');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Estado para el dropdown de Resumen Semanal
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(null);
  
  // Estado para la página actual
  const [currentPage, setCurrentPage] = useState('home');
  // Página desde la que se abrió el menú (para volver de forma segura)
  const [previousPageBeforeMenu, setPreviousPageBeforeMenu] = useState('home');
  
  // Estado para la página de notas de la comunidad
  const [selectedProposalForNotes, setSelectedProposalForNotes] = useState(null);
  
  // Estado para votos de notas de la comunidad (toggle: click otra vez para quitar)
  const [userNoteVotes, setUserNoteVotes] = useState(() => {
    const saved = localStorage.getItem('venezuelaLiveNoteVotes');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Estado para el formulario de agregar nota
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Estado para ideologías del perfil
  const [userIdeologies, setUserIdeologies] = useState([]);
  const [showIdeologyDropdown, setShowIdeologyDropdown] = useState(false);
  const availableIdeologies = [
    'Comunismo',
    'Socialismo', 
    'Liberalismo',
    'Libertarismo',
    'Capitalismo',
    'Anarco-capitalismo',
    'Anarquismo'
  ];
  
  // Estado para threads expandidos (muestra todas las contrapropuestas)
  const [expandedThreads, setExpandedThreads] = useState({});
  
  // Temporizador para mostrar tiempo restante
  const [timeRemaining, setTimeRemaining] = useState('');

  // Formulario de sugerencia de categoría
  const [showCategorySuggestionForm, setShowCategorySuggestionForm] = useState(false);
  const [categorySuggestionSubmitted, setCategorySuggestionSubmitted] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState('');
  const [suggestedSubcategory, setSuggestedSubcategory] = useState('');
  const [suggestedWhy, setSuggestedWhy] = useState('');

  // Modal de límite de tasa (rate limit) y Premium
  const [rateLimitModal, setRateLimitModal] = useState(null); // { action, reason } o null
  const [ticketForm, setTicketForm] = useState({ reference: '', paymentDate: '', amount: '' });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  // Guardar votos en localStorage
  useEffect(() => {
    localStorage.setItem('venezuelaLiveVotes', JSON.stringify(userVotes));
  }, [userVotes]);

  // Guardar votos de notas en localStorage
  useEffect(() => {
    localStorage.setItem('venezuelaLiveNoteVotes', JSON.stringify(userNoteVotes));
  }, [userNoteVotes]);

  // Actualizar temporizador cada minuto
  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(formatTimeRemaining(getNextSundayReset()));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, []);

  const { addError } = useError();

  const handleProfileBack = useCallback(() => setCurrentPage('home'), []);
  const handleProfileLogout = useCallback(() => setEstaAutenticado(false), []);

  // Comprobar sesión expirada (token Google) al recuperar foco o cada 60s
  useEffect(() => {
    if (!estaAutenticado) return;
    const check = () => {
      if (!getStoredAuth()) {
        addError('Tu sesión ha expirado. Inicia sesión de nuevo.', 'session_expired');
        setEstaAutenticado(false);
      }
    };
    const interval = setInterval(check, 60000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [estaAutenticado, addError]);

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopicName || !newProposalTitle || !newProposalDesc || !newProposalAuthor) return;

    try {
      const result = await api.consumeAction('proposals');
      if (!result.ok) {
        setRateLimitModal({ action: result.action || 'proposals', reason: result.reason });
        return;
      }
    } catch {
      addError?.('No se pudo crear la propuesta. Intenta de nuevo.');
      return;
    }

    const newThread = {
      id: 't' + Date.now(),
      category: newTopicCategory,
      subcategory: newTopicSubcategory,
      topic: newTopicName,
      proposals: [
        {
          id: 'p' + Date.now(),
          title: newProposalTitle,
          description: newProposalDesc,
          author: newProposalAuthor,
          upvotes: 1,
          downvotes: 0,
          netScore: 1,
          comments: [],
          notes: []
        }
      ]
    };

    setThreads([newThread, ...threads]);
    setIsModalOpen(false);
    setNewTopicName('');
    setNewProposalTitle('');
    setNewProposalDesc('');
    setNewProposalAuthor('');
  };

  const handleAddComment = async (threadId, proposalId, text, position) => {
    try {
      const result = await api.consumeAction('comments');
      if (!result.ok) {
        setRateLimitModal({ action: result.action || 'comments', reason: result.reason });
        return false;
      }
    } catch {
      addError?.('No se pudo publicar el comentario. Intenta de nuevo.');
      return false;
    }
    setThreads(prevThreads => prevThreads.map(thread => {
      if (thread.id !== threadId) return thread;
      return {
        ...thread,
        proposals: thread.proposals.map(prop => {
          if (prop.id !== proposalId) return prop;
          return {
            ...prop,
            comments: [...(prop.comments || []), { id: Date.now().toString(), text, position }]
          };
        })
      };
    }));
    return true;
  };

  // Manejar votos de notas de la comunidad (con toggle)
  const handleNoteVote = (threadId, proposalId, noteId, isUpvote) => {
    const voteKey = `${proposalId}_${noteId}`;
    const currentVote = userNoteVotes[voteKey];
    const voteType = isUpvote ? 'up' : 'down';

    // Si ya votó lo mismo, quitar el voto (toggle)
    if (currentVote === voteType) {
      setUserNoteVotes(prev => {
        const newVotes = { ...prev };
        delete newVotes[voteKey];
        return newVotes;
      });
      
      setThreads(prevThreads => prevThreads.map(thread => {
        if (thread.id !== threadId) return thread;
        return {
          ...thread,
          proposals: thread.proposals.map(prop => {
            if (prop.id !== proposalId) return prop;
            return {
              ...prop,
              notes: (prop.notes || []).map(note => {
                if (note.id !== noteId) return note;
                const newUpvotes = isUpvote ? (note.upvotes || 0) - 1 : (note.upvotes || 0);
                const newDownvotes = isUpvote ? (note.downvotes || 0) : (note.downvotes || 0) - 1;
                return { ...note, upvotes: newUpvotes, downvotes: newDownvotes, netScore: newUpvotes - newDownvotes };
              })
            };
          })
        };
      }));
      
      // Actualizar selectedProposalForNotes
      setSelectedProposalForNotes(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          notes: (prev.notes || []).map(note => {
            if (note.id !== noteId) return note;
            const newUpvotes = isUpvote ? (note.upvotes || 0) - 1 : (note.upvotes || 0);
            const newDownvotes = isUpvote ? (note.downvotes || 0) : (note.downvotes || 0) - 1;
            return { ...note, upvotes: newUpvotes, downvotes: newDownvotes, netScore: newUpvotes - newDownvotes };
          })
        };
      });
      return;
    }

    // Si votó diferente, cambiar el voto
    let adjustment = { up: 0, down: 0 };
    if (currentVote) {
      if (currentVote === 'up') adjustment.up = -1;
      if (currentVote === 'down') adjustment.down = -1;
    }
    if (isUpvote) adjustment.up += 1;
    else adjustment.down += 1;

    setUserNoteVotes(prev => ({ ...prev, [voteKey]: voteType }));

    setThreads(prevThreads => prevThreads.map(thread => {
      if (thread.id !== threadId) return thread;
      return {
        ...thread,
        proposals: thread.proposals.map(prop => {
          if (prop.id !== proposalId) return prop;
          return {
            ...prop,
            notes: (prop.notes || []).map(note => {
              if (note.id !== noteId) return note;
              const newUpvotes = (note.upvotes || 0) + adjustment.up;
              const newDownvotes = (note.downvotes || 0) + adjustment.down;
              return { ...note, upvotes: newUpvotes, downvotes: newDownvotes, netScore: newUpvotes - newDownvotes };
            })
          };
        })
      };
    }));

    // Actualizar selectedProposalForNotes
    setSelectedProposalForNotes(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: (prev.notes || []).map(note => {
          if (note.id !== noteId) return note;
          const newUpvotes = (note.upvotes || 0) + adjustment.up;
          const newDownvotes = (note.downvotes || 0) + adjustment.down;
          return { ...note, upvotes: newUpvotes, downvotes: newDownvotes, netScore: newUpvotes - newDownvotes };
        })
      };
    });
  };

  // Agregar nueva nota de la comunidad
  const handleAddNote = (threadId, proposalId, text) => {
    if (!text.trim()) return;
    
    const newNote = {
      id: 'n' + Date.now(),
      text: text.trim(),
      upvotes: 0,
      downvotes: 0,
      netScore: 0
    };

    setThreads(prevThreads => prevThreads.map(thread => {
      if (thread.id !== threadId) return thread;
      return {
        ...thread,
        proposals: thread.proposals.map(prop => {
          if (prop.id !== proposalId) return prop;
          const notes = prop.notes || [];
          if (notes.length >= 5) return prop;
          return { ...prop, notes: [...notes, newNote] };
        })
      };
    }));

    // Actualizar selectedProposalForNotes
    setSelectedProposalForNotes(prev => {
      if (!prev) return prev;
      const notes = prev.notes || [];
      if (notes.length >= 5) return prev;
      return { ...prev, notes: [...notes, newNote] };
    });

    setNewNoteText('');
    setShowAddNoteForm(false);
  };

  const handleVote = async (threadId, proposalId, isUpvote) => {
    const voteKey = proposalId;
    const currentVote = userVotes[voteKey];
    const voteType = isUpvote ? 'up' : 'down';
    
    // Verificar si puede votar esta semana
    if (currentVote && !canVoteThisWeek(currentVote.timestamp)) {
      return; // Ya votó esta semana en esta propuesta
    }
    
    // Verificar si ya tiene un voto diferente esta semana (solo puede 1 like O 1 dislike)
    if (currentVote && canVoteThisWeek(currentVote.timestamp) === false) {
      return;
    }
    
    // Si ya votó lo mismo, no hacer nada
    if (currentVote && currentVote.type === voteType && !canVoteThisWeek(currentVote.timestamp)) {
      return;
    }

    // Rate limit: consumir cuota de likes (cada voto up/down cuenta)
    try {
      const result = await api.consumeAction('likes');
      if (!result.ok) {
        setRateLimitModal({ action: result.action || 'likes', reason: result.reason });
        return;
      }
    } catch {
      addError?.('No se pudo procesar el voto. Intenta de nuevo.');
      return;
    }

    setThreads(prevThreads => prevThreads.map(thread => {
      if (thread.id !== threadId) return thread;

      const updatedProposals = thread.proposals.map(prop => {
        if (prop.id !== proposalId) return prop;
        
        let newUpvotes = prop.upvotes;
        let newDownvotes = prop.downvotes;
        
        // Si ya había votado esta semana y puede volver a votar, remover voto anterior
        if (currentVote && canVoteThisWeek(currentVote.timestamp)) {
          if (currentVote.type === 'up') newUpvotes--;
          if (currentVote.type === 'down') newDownvotes--;
        }
        
        // Agregar nuevo voto
        if (isUpvote) {
          newUpvotes++;
        } else {
          newDownvotes++;
        }
        
        return {
          ...prop,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          netScore: newUpvotes - newDownvotes
        };
      });

      return { ...thread, proposals: updatedProposals };
    }));

    // Registrar el voto del usuario
    setUserVotes(prev => ({
      ...prev,
      [voteKey]: {
        type: voteType,
        timestamp: new Date().toISOString()
      }
    }));
  };
  
  // Verificar si el usuario puede votar en una propuesta específica
  const canUserVote = (proposalId) => {
    const vote = userVotes[proposalId];
    if (!vote) return { canVote: true, currentVote: null };
    return {
      canVote: canVoteThisWeek(vote.timestamp),
      currentVote: vote.type
    };
  };

  /**
   * Data pipeline: filtrado estricto por categoría + ordenamiento por likes netos (netScore) descendente.
   * - Filtrado: Array.prototype.filter(), activado únicamente por event listeners onClick en selectores.
   * - Ordenamiento: Array.prototype.sort() por netScore desc como invariante de la UI.
   * - Encadenamiento: filter (si categoría activa) → map (sort proposals) → filter (validación).
   */
  const filteredThreads = useMemo(() => {
    try {
      const sourceThreads = Array.isArray(threads) ? threads : [];
      
      return sourceThreads
        .filter(thread => {
          try {
            if (!thread || typeof thread !== 'object') return false;
            const categoryMatch = activeCategory === 'Todas' || thread.category === activeCategory;
            const subcategoryMatch = !activeSubcategory || thread.subcategory === activeSubcategory;
            return categoryMatch && subcategoryMatch;
          } catch {
            return false;
          }
        })
        .map(thread => {
          try {
            const rawProposals = thread.proposals;
            const proposalsArray = Array.isArray(rawProposals) ? [...rawProposals] : [];
            const sortedProposals = proposalsArray.sort((a, b) => {
              const scoreA = typeof a?.netScore === 'number' ? a.netScore : 0;
              const scoreB = typeof b?.netScore === 'number' ? b.netScore : 0;
              return scoreB - scoreA;
            });
            return {
              ...thread,
              king: sortedProposals[0] ?? null,
              challengers: sortedProposals.slice(1)
            };
          } catch {
            return { ...thread, king: null, challengers: [] };
          }
        })
        .filter(thread => {
          try {
            if (!thread?.king) return false;
            const score = typeof thread.king.netScore === 'number' ? thread.king.netScore : 0;
            return filterMode === 'cielo' ? score >= 0 : score < 0;
          } catch {
            return false;
          }
        });
    } catch (err) {
      addError?.('Error al procesar las propuestas. Recarga la página.', 'pipeline_error');
      return [];
    }
  }, [threads, activeCategory, activeSubcategory, filterMode, addError]);

  const ProposalCard = ({ threadId, proposal, isKing }) => {
    const isNegative = proposal.netScore < 0;
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [commentPosition, setCommentPosition] = useState('favor');
    
    // Obtener estado de voto del usuario para esta propuesta
    const { canVote, currentVote } = canUserVote(proposal.id);

    const submitComment = async () => {
      if (commentText.trim().length === 0) return;
      const ok = await handleAddComment(threadId, proposal.id, commentText, commentPosition);
      if (ok) {
        setCommentText('');
        setCommentPosition('favor');
      }
    };
    
    const topNote = (() => {
      try {
        const notes = proposal?.notes;
        if (!Array.isArray(notes) || notes.length === 0) return null;
        const sorted = [...notes].sort((a, b) => {
          const sa = typeof a?.netScore === 'number' ? a.netScore : 0;
          const sb = typeof b?.netScore === 'number' ? b.netScore : 0;
          return sb - sa;
        });
        return sorted[0] ?? null;
      } catch {
        return null;
      }
    })();

    return (
      <div className={`p-5 rounded-2xl border-2 transition-all duration-200 ${
        isKing 
          ? 'bg-slate-700/60 border-slate-500/70 shadow-lg shadow-slate-900/30' 
          : 'bg-slate-700/40 border-slate-600/50 mt-3'
      }`}>
        {isKing && (
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <span>👑 Propuesta Principal (Rey de la Colina)</span>
          </div>
        )}
        
        <h3 className={`text-slate-200 font-bold mb-2 ${isKing ? 'text-xl' : 'text-lg'}`}>
          {proposal.title}
        </h3>
        
        <p className={`text-slate-400 mb-4 leading-relaxed ${isKing ? 'text-base' : 'text-sm'}`}>
          {proposal.description}
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span className="bg-slate-600/80 text-slate-300 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-500/50">
            ✍️ {proposal.author}
          </span>
        </div>

        {/* Notas de la Comunidad - Compacto */}
        <div className="mt-4 flex items-center gap-2">
          {topNote && topNote.netScore > 0 && (
            <div className="flex-grow p-2.5 bg-sky-900/30 border border-sky-500/40 rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <p className="text-xs text-sky-300 truncate">
                <span className="md:hidden">{topNote.text.substring(0, 30)}{topNote.text.length > 30 ? '...' : ''}</span>
                <span className="hidden md:inline">{topNote.text.substring(0, 50)}{topNote.text.length > 50 ? '...' : ''}</span>
              </p>
            </div>
          )}
          <button 
            onClick={() => {
              setSelectedProposalForNotes({ threadId, proposalId: proposal.id, notes: proposal.notes || [] });
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-sky-900/30 hover:bg-sky-900/50 border border-sky-500/40 text-sky-400 rounded-xl text-xs font-bold transition flex-shrink-0"
            title="Ver notas de la comunidad"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm ${
            isNegative 
              ? 'bg-red-900/40 text-red-400 border border-red-700/50' 
              : 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50'
          }`}>
            {isNegative ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            <span>{proposal.netScore > 0 ? '+' : ''}{proposal.netScore} Neto</span>
          </div>

          <div className="flex items-center gap-0 border-2 border-slate-500/50 rounded-xl overflow-hidden bg-slate-800/50">
            <button 
              onClick={() => handleVote(threadId, proposal.id, true)}
              disabled={!canVote && currentVote !== null}
              className={`flex items-center gap-1.5 px-4 py-2 transition ${
                currentVote === 'up' 
                  ? 'bg-emerald-900/50 text-emerald-400' 
                  : !canVote && currentVote !== null
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:bg-emerald-900/30 hover:text-emerald-400'
              }`}
              title={!canVote && currentVote !== null ? 'Ya votaste esta semana' : 'Apoyar'}
            >
              <ThumbsUp className={`w-4 h-4 ${currentVote === 'up' ? 'fill-emerald-400' : ''}`} />
              <span className="text-sm font-semibold">{proposal.upvotes}</span>
            </button>
            <div className="w-px h-6 bg-slate-500/50"></div>
            <button 
              onClick={() => handleVote(threadId, proposal.id, false)}
              disabled={!canVote && currentVote !== null}
              className={`flex items-center gap-1.5 px-4 py-2 transition ${
                currentVote === 'down' 
                  ? 'bg-red-900/50 text-red-400' 
                  : !canVote && currentVote !== null
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:bg-red-900/30 hover:text-red-400'
              }`}
              title={!canVote && currentVote !== null ? 'Ya votaste esta semana' : 'Rechazar'}
            >
              <ThumbsDown className={`w-4 h-4 ${currentVote === 'down' ? 'fill-red-400' : ''}`} />
              <span className="text-sm font-semibold">{proposal.downvotes}</span>
            </button>
          </div>

          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-600/50 hover:text-slate-300 transition border border-slate-600/50"
            title="Comentarios"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">{proposal.comments?.length || 0}</span>
          </button>

          {!isKing && (
            <span className="text-xs text-slate-500 font-semibold ml-auto uppercase tracking-wide">
              Retador
            </span>
          )}
        </div>

        {showComments && (
          <div className="mt-5 pt-5 border-t border-slate-600/50">
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
              {(proposal.comments || []).length === 0 ? (
                <p className="text-sm text-slate-500 italic">No hay comentarios aún. ¡Sé el primero!</p>
              ) : (
                (proposal.comments || []).map(c => (
                  <div key={c.id} className={`p-4 rounded-xl text-sm border ${
                    c.position === 'favor' 
                      ? 'bg-emerald-900/20 border-emerald-700/40' 
                      : 'bg-red-900/20 border-red-700/40'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      {c.position === 'favor' 
                        ? <ThumbsUp className="w-3 h-3 text-emerald-500" /> 
                        : <ThumbsDown className="w-3 h-3 text-red-500" />
                      }
                      <span className={`text-xs font-bold uppercase tracking-wide ${
                        c.position === 'favor' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        En {c.position}
                      </span>
                    </div>
                    <p className="text-slate-300">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-600/50">
              <div className="flex gap-2 mb-3">
                <button 
                  onClick={() => setCommentPosition('favor')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition border ${
                    commentPosition === 'favor' 
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-600/50' 
                      : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-700'
                  }`}
                >
                  👍 A Favor
                </button>
                <button 
                  onClick={() => setCommentPosition('contra')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition border ${
                    commentPosition === 'contra' 
                      ? 'bg-red-900/40 text-red-400 border-red-600/50' 
                      : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-700'
                  }`}
                >
                  👎 En Contra
                </button>
              </div>
              <textarea 
                maxLength={500}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe tu opinión (max 500 caracteres)..."
                className="w-full text-sm p-3 bg-slate-700/50 border border-slate-500/50 rounded-xl resize-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none text-slate-300 placeholder-slate-500"
                rows="2"
              ></textarea>
              <div className="flex justify-between items-center mt-3">
                <span className={`text-xs ${commentText.length >= 500 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                  {commentText.length}/500
                </span>
                <button 
                  onClick={submitComment}
                  disabled={commentText.trim().length === 0}
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:text-slate-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
                >
                  <Send className="w-4 h-4" /> Enviar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-2 text-cyan-400">
          <Activity className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!estaAutenticado) {
    if (AUTH_PAUSED) {
      return <LoginBypass setEstaAutenticado={setEstaAutenticado} />;
    }
    return <Login setEstaAutenticado={setEstaAutenticado} />;
  }

  return (
    <div className="min-h-screen bg-black text-slate-300 font-sans">
      {/* HEADER */}
      <header className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="https://flagcdn.com/w40/ve.png" alt="Venezuela" className="w-8 h-6 object-cover rounded-sm" />
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="text-yellow-400">VEN</span><span className="text-blue-500">EZU</span><span className="text-red-500">ELA</span> <span className="text-white">LIVE</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Botón Menú: abre página de menú o vuelve si ya estás en ella */}
            <button 
              onClick={() => {
                if (currentPage === 'menu') {
                  const backTo = VALID_PAGES.includes(previousPageBeforeMenu) ? previousPageBeforeMenu : 'home';
                  setCurrentPage(backTo);
                } else {
                  setPreviousPageBeforeMenu(currentPage);
                  setCurrentPage('menu');
                }
              }}
              className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl transition"
              aria-label={currentPage === 'menu' ? 'Volver' : 'Abrir menú'}
            >
              {currentPage === 'menu' ? (
                <ArrowLeft className="w-5 h-5 text-slate-300" />
              ) : (
                <Menu className="w-5 h-5 text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* PÁGINA DE MENÚ (página separada con más espacio) */}
      {currentPage === 'menu' && (
        <main className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => {
              const backTo = VALID_PAGES.includes(previousPageBeforeMenu) ? previousPageBeforeMenu : 'home';
              setCurrentPage(backTo);
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-8 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Volver</span>
          </button>
          <h2 className="text-2xl font-bold text-slate-200 mb-6">Menú</h2>
          <div className="space-y-4">
            <button
              onClick={() => {
                clearAuth();
                setEstaAutenticado(false);
              }}
              className="w-full flex items-center gap-4 px-6 py-5 bg-red-900/20 hover:bg-red-900/30 border border-red-700/50 text-red-400 font-bold rounded-2xl transition text-left"
            >
              <LogOut className="w-6 h-6 flex-shrink-0" />
              Cerrar sesión
            </button>
            <button
              onClick={() => setCurrentPage('general')}
              className="w-full flex items-center gap-4 px-6 py-5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-cyan-400 font-bold rounded-2xl transition text-left"
            >
              <Settings className="w-6 h-6 flex-shrink-0" />
              General
            </button>
            <button
              onClick={() => setCurrentPage('perfil')}
              className="w-full flex items-center gap-4 px-6 py-5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-cyan-400 font-bold rounded-2xl transition text-left"
            >
              <User className="w-6 h-6 flex-shrink-0" />
              Perfil
            </button>
            <button
              onClick={() => setCurrentPage('premium')}
              className="w-full flex items-center gap-4 px-6 py-5 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-600/50 text-amber-400 font-bold rounded-2xl transition text-left"
            >
              <Crown className="w-6 h-6 flex-shrink-0" />
              Obtener Premium
            </button>
          </div>
        </main>
      )}

      {/* PÁGINA GENERAL - Landing profesional */}
      {currentPage === 'general' && (
        <main className="max-w-4xl mx-auto px-4 py-8">
          <button 
            onClick={() => setCurrentPage('home')}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver al inicio</span>
          </button>

          {/* Landing: información institucional */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <img src="https://flagcdn.com/w80/ve.png" alt="Venezuela" className="w-12 h-9 object-cover rounded-md" />
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Venezuela LIVE</h2>
                <p className="text-slate-400 text-sm">Plataforma de debate y consenso ciudadano</p>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed mb-6">
              Conectamos ideas, propuestas y voces de la sociedad venezolana. Aquí puedes votar, comentar y aportar
              notas de contexto sobre temas de economía, salud, educación, seguridad y servicios públicos.
            </p>
            <button
              onClick={() => setCurrentPage('home')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition"
            >
              Explorar categorías
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
          
          {/* Menú de acciones */}
          <div className="flex flex-wrap gap-4 mb-8">
            <button 
              onClick={() => setIsWeeklySummaryOpen(!isWeeklySummaryOpen)}
              className="flex items-center gap-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-400 px-6 py-4 rounded-xl text-sm font-bold transition"
            >
              <BarChart3 className="w-5 h-5" />
              Resumen semanal
            </button>
            
            <div className="flex items-center gap-3 bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 px-6 py-4 rounded-xl text-sm font-bold">
              <Clock className="w-5 h-5" />
              <div>
                <span className="block text-xs text-slate-500">Próximo reinicio</span>
                <span className="text-cyan-400 font-bold">{timeRemaining}</span>
              </div>
            </div>
            
            <button 
              onClick={() => setCurrentPage('donations')}
              className="flex items-center gap-3 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 text-pink-400 px-6 py-4 rounded-xl text-sm font-bold transition"
            >
              <Heart className="w-5 h-5" />
              Donaciones
            </button>
            
            <button 
              onClick={() => setCurrentPage('nosotros')}
              className="flex items-center gap-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-400 px-6 py-4 rounded-xl text-sm font-bold transition"
            >
              <Users className="w-5 h-5" />
              Nosotros
            </button>
            
            <button 
              onClick={() => {
                setShowCategorySuggestionForm(true);
                setCategorySuggestionSubmitted(false);
                setSuggestedCategory('');
                setSuggestedSubcategory('');
                setSuggestedWhy('');
              }}
              className="flex items-center gap-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 px-6 py-4 rounded-xl text-sm font-bold transition"
            >
              <FolderPlus className="w-5 h-5" />
              Sugerir nueva categoría
            </button>
          </div>

          {/* Formulario de sugerencia de categoría */}
          {showCategorySuggestionForm && (
            <div className="mb-10 bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <FolderPlus className="w-5 h-5" />
                Sugerir categoría nueva
              </h3>
              {categorySuggestionSubmitted ? (
                <div className="py-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-900/40 mb-4">
                    <Heart className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-xl font-bold text-slate-200 mb-2">¡Gracias por tu sugerencia!</p>
                  <p className="text-slate-400 text-sm">Revisaremos tu propuesta y te tendremos en cuenta.</p>
                  <button
                    onClick={() => setShowCategorySuggestionForm(false)}
                    className="mt-6 px-5 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-semibold transition"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = import.meta.env.VITE_SUGGESTIONS_EMAIL || 'sugerencias@venezuelalive.com';
                    const subject = encodeURIComponent(`[Venezuela LIVE] Sugerencia: ${suggestedCategory} / ${suggestedSubcategory}`);
                    const body = encodeURIComponent(
                      `Nueva categoría sugerida:\n\n` +
                      `Categoría: ${suggestedCategory}\n` +
                      `Subcategoría: ${suggestedSubcategory}\n\n` +
                      `¿Por qué es importante?\n${suggestedWhy}`
                    );
                    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                    setCategorySuggestionSubmitted(true);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">¿Qué nueva categoría deseas?</label>
                    <input
                      type="text"
                      value={suggestedCategory}
                      onChange={(e) => setSuggestedCategory(e.target.value)}
                      placeholder="Ej: Cultura, Deporte, Medio Ambiente..."
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">¿Qué subcategoría propones?</label>
                    <input
                      type="text"
                      value={suggestedSubcategory}
                      onChange={(e) => setSuggestedSubcategory(e.target.value)}
                      placeholder="Ej: Patrimonio, Reciclaje, Biodiversidad..."
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">¿Por qué crees que es importante?</label>
                    <textarea
                      value={suggestedWhy}
                      onChange={(e) => setSuggestedWhy(e.target.value)}
                      placeholder="Explica brevemente por qué esta categoría aportaría valor a la plataforma..."
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none resize-none"
                      required
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
                    >
                      <Mail className="w-4 h-4" />
                      Enviar por correo
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCategorySuggestionForm(false)}
                      className="px-5 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-semibold transition"
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Se abrirá tu cliente de correo con los datos. Si no tienes uno configurado, copia el contenido y envíalo manualmente.
                  </p>
                </form>
              )}
            </div>
          )}
          
          {/* Panel de Resumen Semanal expandido */}
          {isWeeklySummaryOpen && (
            <div className="mt-8 bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Resumen Semanal
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={async () => {
                    setReportDownloading('positives');
                    try {
                      await api.downloadReport('positives');
                    } catch (err) {
                      addError(err?.message || 'Error al descargar reporte Consenso.');
                    } finally {
                      setReportDownloading(null);
                    }
                  }}
                  disabled={reportDownloading !== null}
                  className="flex items-center gap-3 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 text-emerald-400 px-5 py-4 rounded-xl text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FileText className="w-5 h-5" />
                  {reportDownloading === 'positives' ? 'Descargando...' : 'Consenso'}
                </button>
                <button
                  onClick={async () => {
                    setReportDownloading('volume');
                    try {
                      await api.downloadReport('volume');
                    } catch (err) {
                      addError(err?.message || 'Error al descargar reporte Conflicto.');
                    } finally {
                      setReportDownloading(null);
                    }
                  }}
                  disabled={reportDownloading !== null}
                  className="flex items-center gap-3 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/40 text-amber-400 px-5 py-4 rounded-xl text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="w-5 h-5" />
                  {reportDownloading === 'volume' ? 'Descargando...' : 'Conflicto'}
                </button>
                <button
                  onClick={async () => {
                    setReportDownloading('negatives');
                    try {
                      await api.downloadReport('negatives');
                    } catch (err) {
                      addError(err?.message || 'Error al descargar reporte Rechazo.');
                    } finally {
                      setReportDownloading(null);
                    }
                  }}
                  disabled={reportDownloading !== null}
                  className="flex items-center gap-3 bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400 px-5 py-4 rounded-xl text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ThumbsDown className="w-5 h-5" />
                  {reportDownloading === 'negatives' ? 'Descargando...' : 'Rechazo'}
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* LANDING DONACIONES */}
      {currentPage === 'donations' && (
        <main className="max-w-3xl mx-auto px-4 py-8">
          <button
            onClick={() => setCurrentPage('general')}
            className="flex items-center gap-2 text-slate-400 hover:text-pink-400 mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver a General</span>
          </button>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-pink-600/20 border border-pink-500/40">
              <Heart className="w-8 h-8 text-pink-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Donaciones</h2>
              <p className="text-slate-400 text-sm">Apoya la plataforma Venezuela LIVE</p>
            </div>
          </div>
          <p className="text-slate-300 leading-relaxed mb-6">
            Venezuela LIVE es una plataforma sin fines de lucro dedicada a amplificar las voces de la sociedad venezolana.
            Tu donación permite mantener los servidores, desarrollar nuevas funciones y garantizar que el debate ciudadano
            siga siendo accesible para todos.
          </p>
          <div className="space-y-4 mb-8">
            <div className="p-4 bg-pink-900/20 rounded-xl border border-pink-700/40">
              <h3 className="font-bold text-pink-400 mb-2">¿A dónde van las donaciones?</h3>
              <p className="text-slate-300 text-sm">Infraestructura Cloudflare (hosting, base de datos), desarrollo de nuevas categorías, y mejoras de seguridad y accesibilidad.</p>
            </div>
            <div className="p-4 bg-pink-900/20 rounded-xl border border-pink-700/40">
              <h3 className="font-bold text-pink-400 mb-2">Formas de contribuir</h3>
              <p className="text-slate-300 text-sm mb-3">Aceptamos contribuciones por PayPal, transferencia bancaria y criptomonedas (USDT, USDC). Todas las donaciones son opcionales y confidenciales.</p>
              <a
                href="mailto:donaciones@venezuelalive.com?subject=Donación Venezuela LIVE"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-sm transition"
              >
                <Mail className="w-4 h-4" />
                Contactar para donar
              </a>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage('home')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-semibold transition"
          >
            Explorar debates
          </button>
        </main>
      )}

      {/* LANDING NOSOTROS */}
      {currentPage === 'nosotros' && (
        <main className="max-w-3xl mx-auto px-4 py-8">
          <button
            onClick={() => setCurrentPage('general')}
            className="flex items-center gap-2 text-slate-400 hover:text-amber-400 mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver a General</span>
          </button>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/40">
              <Users className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Nosotros</h2>
              <p className="text-slate-400 text-sm">Conoce Venezuela LIVE</p>
            </div>
          </div>
          <p className="text-slate-300 leading-relaxed mb-6">
            Venezuela LIVE nació en 2024 como un proyecto ciudadano para facilitar el debate constructivo sobre
            temas de interés nacional. Creemos que la participación informada y la exposición de múltiples perspectivas
            son la base para encontrar consensos y construir soluciones.
          </p>
          <div className="space-y-4 mb-8">
            <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-700/40">
              <h3 className="font-bold text-amber-400 mb-2">Nuestra misión</h3>
              <p className="text-slate-300 text-sm">Conectar ideas, propuestas y voces de la sociedad venezolana mediante una plataforma neutra donde cada usuario puede votar, comentar y aportar notas de contexto verificable.</p>
            </div>
            <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-700/40">
              <h3 className="font-bold text-amber-400 mb-2">Cómo funciona</h3>
              <p className="text-slate-300 text-sm">Organizamos debates por categorías (Economía, Salud, Educación, etc.). Cada tema tiene propuestas que la comunidad puede apoyar o rechazar con likes/dislikes, además de comentarios y notas de la comunidad para aportar contexto.</p>
            </div>
            <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-700/40">
              <h3 className="font-bold text-amber-400 mb-2">Contacto</h3>
              <p className="text-slate-300 text-sm mb-3">¿Preguntas, sugerencias o propuestas de colaboración? Escríbenos.</p>
              <a
                href="mailto:contacto@venezuelalive.com?subject=Consulta Venezuela LIVE"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition"
              >
                <Mail className="w-4 h-4" />
                contacto@venezuelalive.com
              </a>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage('home')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-semibold transition"
          >
            Explorar debates
          </button>
        </main>
      )}

      {/* PÁGINA DE NOTAS DE LA COMUNIDAD */}
      {selectedProposalForNotes && (
        <main className="max-w-2xl mx-auto px-4 py-8">
          <button 
            onClick={() => setSelectedProposalForNotes(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver a la propuesta</span>
          </button>
          
          <h2 className="text-2xl font-bold text-slate-200 mb-2 flex items-center gap-3">
            <Shield className="w-6 h-6 text-sky-400" />
            Notas de la Comunidad
          </h2>
          <p className="text-slate-500 text-sm mb-8">Las notas ayudan a verificar y contextualizar las propuestas</p>
          
          {/* Lista de notas existentes */}
          <div className="space-y-4 mb-8">
            {selectedProposalForNotes.notes && selectedProposalForNotes.notes.length > 0 ? (
              selectedProposalForNotes.notes.slice(0, 5).map((note, index) => {
                const voteKey = `${selectedProposalForNotes.proposalId}_${note.id}`;
                const currentNoteVote = userNoteVotes[voteKey];
                return (
                  <div key={note.id || index} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
                    <p className="text-slate-300 text-sm mb-4">{note.text}</p>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleNoteVote(selectedProposalForNotes.threadId, selectedProposalForNotes.proposalId, note.id, true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          currentNoteVote === 'up' 
                            ? 'bg-emerald-700/60 border border-emerald-500/60 text-emerald-300' 
                            : 'bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 text-emerald-400'
                        }`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${currentNoteVote === 'up' ? 'fill-emerald-300' : ''}`} />
                        <span>{note.upvotes || 0}</span>
                      </button>
                      <button 
                        onClick={() => handleNoteVote(selectedProposalForNotes.threadId, selectedProposalForNotes.proposalId, note.id, false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          currentNoteVote === 'down' 
                            ? 'bg-red-700/60 border border-red-500/60 text-red-300' 
                            : 'bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400'
                        }`}
                      >
                        <ThumbsDown className={`w-3.5 h-3.5 ${currentNoteVote === 'down' ? 'fill-red-300' : ''}`} />
                        <span>{note.downvotes || 0}</span>
                      </button>
                      <span className="text-xs text-slate-500 ml-auto">
                        Puntuación: <span className={note.netScore > 0 ? 'text-emerald-400' : note.netScore < 0 ? 'text-red-400' : 'text-slate-400'}>{note.netScore || 0}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-slate-800/40 rounded-xl border border-dashed border-slate-700/50 p-8 text-center">
                <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No hay notas de la comunidad todavía</p>
                <p className="text-slate-600 text-xs mt-1">Sé el primero en agregar contexto a esta propuesta</p>
              </div>
            )}
          </div>
          
          {/* Formulario o botón para agregar nueva nota */}
          {showAddNoteForm ? (
            <div className="bg-slate-800/60 rounded-xl border border-sky-500/40 p-4">
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Escribe tu nota de la comunidad aquí..."
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500/50 resize-none"
                rows={3}
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => handleAddNote(selectedProposalForNotes.threadId, selectedProposalForNotes.proposalId, newNoteText)}
                  disabled={!newNoteText.trim()}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                    newNoteText.trim()
                      ? 'bg-sky-600 hover:bg-sky-500 text-white'
                      : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Publicar nota
                </button>
                <button
                  onClick={() => { setShowAddNoteForm(false); setNewNoteText(''); }}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-400 rounded-lg text-sm font-bold transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAddNoteForm(true)}
              disabled={selectedProposalForNotes.notes && selectedProposalForNotes.notes.length >= 5}
              className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-bold transition ${
                selectedProposalForNotes.notes && selectedProposalForNotes.notes.length >= 5
                  ? 'bg-slate-800/30 border border-slate-700/30 text-slate-600 cursor-not-allowed'
                  : 'bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-400'
              }`}
            >
              <PlusCircle className="w-5 h-5" />
              {selectedProposalForNotes.notes && selectedProposalForNotes.notes.length >= 5 
                ? 'Máximo de notas alcanzado (5/5)' 
                : 'Hacer nota de la comunidad'}
            </button>
          )}
        </main>
      )}

      {/* PÁGINA PERFIL */}
      {currentPage === 'perfil' && (
        <Profile
          onBack={handleProfileBack}
          onLogout={handleProfileLogout}
          userIdeologies={userIdeologies}
          setUserIdeologies={setUserIdeologies}
          showIdeologyDropdown={showIdeologyDropdown}
          setShowIdeologyDropdown={setShowIdeologyDropdown}
          availableIdeologies={availableIdeologies}
        />
      )}

      {/* PÁGINA PRINCIPAL */}
      {currentPage === 'home' && !selectedProposalForNotes && (
      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* SIDEBAR */}
        <aside className="md:w-64 flex-shrink-0">
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5 sticky top-24 backdrop-blur-sm">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Categorías</h2>
            <ul className="space-y-1">
              <li>
                <button 
                  onClick={() => {
                    setActiveCategory('Todas');
                    setActiveSubcategory(null);
                    setIsCategoryListOpen(!isCategoryListOpen);
                  }}
                  className={`w-full flex justify-between items-center px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                    activeCategory === 'Todas' 
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40' 
                      : 'hover:bg-slate-700/50 text-slate-400 border border-transparent'
                  }`}
                >
                  Todas las categorías
                  <ChevronDown className={`w-4 h-4 transition-transform ${isCategoryListOpen ? 'rotate-180' : ''}`} />
                </button>
              </li>
              
              {isCategoryListOpen && CATEGORY_TREE.map(cat => (
                <li key={cat.name} className="ml-2 mt-1">
                  <button 
                    onClick={() => {
                      setActiveCategory(cat.name);
                      setActiveSubcategory(null);
                      setExpandedCategory(expandedCategory === cat.name ? null : cat.name);
                    }}
                    className={`w-full flex justify-between items-center text-left px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                      activeCategory === cat.name && !activeSubcategory 
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40' 
                        : 'hover:bg-slate-700/50 text-slate-400 border border-transparent'
                    }`}
                  >
                    {cat.name}
                    {cat.subcategories.length > 0 && (
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandedCategory === cat.name ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  
                  {expandedCategory === cat.name && (
                    <ul className="ml-3 mt-2 space-y-1 border-l-2 border-slate-700 pl-3">
                      {cat.subcategories.map(sub => (
                        <li key={sub}>
                          <button 
                            onClick={() => {
                              setActiveCategory(cat.name);
                              setActiveSubcategory(sub);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition ${
                              activeSubcategory === sub 
                                ? 'bg-cyan-600/30 text-cyan-300 font-bold' 
                                : 'hover:bg-slate-700/50 text-slate-500'
                            }`}
                          >
                            {sub}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

          </div>
        </aside>

        {/* FEED PRINCIPAL */}
        <div className="flex-grow max-w-3xl">
          
          {/* Controles de Vista */}
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-2 flex justify-between items-center mb-8 backdrop-blur-sm">
            <div className="flex bg-slate-900/50 rounded-xl p-1 w-full max-w-sm">
              <button 
                onClick={() => setFilterMode('cielo')}
                className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-bold rounded-lg transition ${
                  filterMode === 'cielo' 
                    ? 'bg-slate-700 text-emerald-400 shadow-lg' 
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                ☁️ Cielo (Consenso)
              </button>
              <button 
                onClick={() => setFilterMode('infierno')}
                className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm font-bold rounded-lg transition ${
                  filterMode === 'infierno' 
                    ? 'bg-slate-700 text-red-400 shadow-lg' 
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                🔥 Infierno (Rechazo)
              </button>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-cyan-900/30"
            >
              <MessageSquare className="w-4 h-4" /> Nuevo Tema
            </button>
          </div>

          {/* Lista de Temas */}
          <div className="space-y-8">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-700/50">
                <p className="text-slate-500 font-medium">No hay propuestas en esta sección.</p>
              </div>
            ) : (
              filteredThreads.map(thread => (
                <article key={thread.id} className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                  {/* Cabecera del Tema */}
                  <div className="bg-slate-800/80 px-6 py-5 border-b border-slate-700/50">
                    <div className="flex gap-2 mb-3">
                      <span className="inline-block px-3 py-1.5 bg-cyan-900/40 text-cyan-400 text-xs font-bold rounded-lg border border-cyan-700/40">
                        {thread.category}
                      </span>
                      {thread.subcategory && (
                        <span className="inline-block px-3 py-1.5 bg-slate-700/60 text-slate-400 text-xs font-bold rounded-lg border border-slate-600/50">
                          {thread.subcategory}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-200 leading-tight">
                      {thread.topic}
                    </h2>
                  </div>

                  {/* Cuerpo: El Rey de la Colina */}
                  <div className="p-6">
                    <ProposalCard threadId={thread.id} proposal={thread.king} isKing={true} />

                    {/* Contrapropuestas */}
                    {thread.challengers.length > 0 && (() => {
                      const isExpanded = expandedThreads[thread.id];
                      const topChallenger = thread.challengers[0];
                      const remainingChallengers = thread.challengers.slice(1);
                      
                      return (
                        <div className="mt-8 ml-4 pl-5 border-l-2 border-slate-600/50 space-y-4 relative">
                          <div className="absolute -left-3 top-0 bg-slate-800 px-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Contrapropuestas ({thread.challengers.length})
                          </div>
                          <div className="pt-5 space-y-4">
                            {/* Siempre mostrar el retador más fuerte */}
                            <div className="relative">
                              <div className="absolute -left-7 top-4 text-xs font-bold text-cyan-400">★</div>
                              <ProposalCard threadId={thread.id} proposal={topChallenger} isKing={false} />
                            </div>
                            
                            {/* Resto de contrapropuestas (colapsables) */}
                            {remainingChallengers.length > 0 && (
                              <>
                                {isExpanded && remainingChallengers.map(challenger => (
                                  <ProposalCard key={challenger.id} threadId={thread.id} proposal={challenger} isKing={false} />
                                ))}
                                
                                <button
                                  onClick={() => setExpandedThreads(prev => ({
                                    ...prev,
                                    [thread.id]: !prev[thread.id]
                                  }))}
                                  className="w-full py-2 text-sm font-medium text-slate-400 hover:text-cyan-400 transition flex items-center justify-center gap-2 bg-slate-700/30 rounded-lg hover:bg-slate-700/50"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-4 h-4" />
                                      Ocultar {remainingChallengers.length} contrapropuesta{remainingChallengers.length > 1 ? 's' : ''}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-4 h-4" />
                                      Ver {remainingChallengers.length} contrapropuesta{remainingChallengers.length > 1 ? 's' : ''} más
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <button className="mt-6 w-full py-4 border-2 border-dashed border-slate-600/50 text-slate-500 font-medium rounded-xl hover:bg-slate-700/30 hover:text-cyan-400 hover:border-cyan-500/40 transition flex justify-center items-center gap-2">
                      <PlusCircle className="w-5 h-5" /> Agregar Contrapropuesta
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </main>
      )}

      {/* MODAL NUEVO TEMA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700/50">
            <div className="flex justify-between items-center p-6 border-b border-slate-700/50 sticky top-0 bg-slate-800 z-10">
              <h2 className="text-xl font-bold text-slate-200">Crear Nuevo Tema y Propuesta</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 transition p-1 hover:bg-slate-700/50 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTopic} className="p-6 space-y-6">
              {/* Categorías */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Categoría</label>
                  <select 
                    value={newTopicCategory}
                    onChange={(e) => {
                      setNewTopicCategory(e.target.value);
                      const subcats = CATEGORY_TREE.find(c => c.name === e.target.value)?.subcategories || [];
                      setNewTopicSubcategory(subcats[0] || '');
                    }}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-3 text-sm text-slate-300 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                  >
                    {CATEGORY_TREE.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Subcategoría</label>
                  <select 
                    value={newTopicSubcategory}
                    onChange={(e) => setNewTopicSubcategory(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-3 text-sm text-slate-300 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                  >
                    {CATEGORY_TREE.find(c => c.name === newTopicCategory)?.subcategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tema Principal */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Problema o Tema a Debatir</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: ¿Cómo solucionar la escasez de agua en la capital?"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                />
              </div>

              <div className="bg-slate-700/30 p-5 rounded-xl border border-slate-600/50 space-y-4">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Tu Propuesta Inicial</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Nombre de la Propuesta</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Privatización de Hidrocapital"
                      value={newProposalTitle}
                      onChange={(e) => setNewProposalTitle(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Tu Firma (Pública)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: JuanPerez99"
                      value={newProposalAuthor}
                      onChange={(e) => setNewProposalAuthor(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Descripción de la Propuesta</label>
                  <textarea 
                    required
                    rows="4"
                    placeholder="Explica en detalle cómo funcionaría tu idea..."
                    value={newProposalDesc}
                    onChange={(e) => setNewProposalDesc(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-500 resize-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 text-sm font-bold text-slate-400 hover:bg-slate-700/50 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-3 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition flex items-center gap-2 shadow-lg shadow-cyan-900/30"
                >
                  <PlusCircle className="w-5 h-5" /> Publicar Tema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de límite de tasa (rate limit) */}
      {rateLimitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setRateLimitModal(null)}>
          <div className="bg-slate-800 rounded-2xl border border-amber-500/50 p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-900/40 border border-amber-500/40">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Límite diario alcanzado</h3>
                <p className="text-sm text-slate-400">{rateLimitModal.reason}</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-6">
              Con el plan <strong className="text-amber-400">Premium</strong> disfrutas de uso ilimitado: likes, comentarios y propuestas sin restricciones.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRateLimitModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-slate-300 text-sm font-semibold transition">
                Cerrar
              </button>
              <button onClick={() => { setCurrentPage('premium'); setRateLimitModal(null); }} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
                <Crown className="w-4 h-4" />
                Obtener Premium
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PÁGINA PREMIUM: alias bancario y formulario de ticket de pago */}
      {currentPage === 'premium' && (
        <main className="max-w-3xl mx-auto px-4 py-8">
          <button onClick={() => setCurrentPage('general')} className="flex items-center gap-2 text-slate-400 hover:text-amber-400 mb-6 transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver</span>
          </button>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/40">
              <Crown className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Plan Premium</h2>
              <p className="text-slate-400 text-sm">Likes, comentarios y propuestas ilimitados</p>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-700/40">
              <h3 className="font-bold text-amber-400 mb-2">Transferencia bancaria</h3>
              <p className="text-slate-300 text-sm mb-3">Realiza tu pago a esta cuenta usando el alias:</p>
              <AliasDisplay />
            </div>

            <div className="p-6 bg-slate-800/60 rounded-2xl border border-slate-700/50">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <Check className="w-5 h-5" />
                Reportar mi pago
              </h3>
              {ticketSubmitted ? (
                <div className="py-6 text-center">
                  <p className="text-slate-200 font-semibold mb-2">Ticket enviado correctamente</p>
                  <p className="text-slate-400 text-sm mb-4">Revisaremos tu pago y te activaremos Premium pronto.</p>
                  <button onClick={() => { setTicketSubmitted(false); setTicketForm({ reference: '', paymentDate: '', amount: '' }); }} className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 rounded-xl text-slate-300 text-sm font-semibold">
                    Enviar otro
                  </button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!ticketForm.reference.trim() || !ticketForm.paymentDate.trim() || !ticketForm.amount) return;
                  setTicketSubmitting(true);
                  try {
                    await api.submitPaymentTicket({ reference: ticketForm.reference.trim(), paymentDate: ticketForm.paymentDate.trim(), amount: Number(ticketForm.amount) });
                    setTicketSubmitted(true);
                  } catch (err) {
                    addError?.(err?.message || 'Error al enviar el ticket.');
                  } finally {
                    setTicketSubmitting(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Número de comprobante/referencia</label>
                    <input type="text" value={ticketForm.reference} onChange={e => setTicketForm(f => ({ ...f, reference: e.target.value }))} placeholder="Ej: 123456789" required className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Fecha del pago</label>
                    <input type="date" value={ticketForm.paymentDate} onChange={e => setTicketForm(f => ({ ...f, paymentDate: e.target.value }))} required className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-amber-500/50 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Monto (USD)</label>
                    <input type="number" min="0" step="0.01" value={ticketForm.amount} onChange={e => setTicketForm(f => ({ ...f, amount: e.target.value }))} placeholder="Ej: 10.00" required className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 outline-none" />
                  </div>
                  <button type="submit" disabled={ticketSubmitting} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-60 flex items-center gap-2">
                    {ticketSubmitting ? 'Enviando...' : 'Enviar ticket'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

/** Componente que muestra el alias bancario y permite copiarlo. */
function AliasDisplay() {
  const [alias, setAlias] = useState('0000 0000 0000 0000 0000 0000');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api.getPremiumStatus().then(r => { if (r?.alias) setAlias(r.alias); }).catch(() => {});
  }, []);
  const copy = () => {
    navigator.clipboard?.writeText(alias).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-600/50">
      <code className="text-cyan-400 font-mono text-sm break-all">{alias}</code>
      <button onClick={copy} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs font-bold transition">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}