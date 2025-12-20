import { useState, useEffect, useRef } from 'react';
import {
  Home,
  Search,
  Bell,
  Mail,
  User,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Image as ImageIcon,
  Smile,
  X,
  Send,
  UserPlus,
  Settings,
  LogOut,
  Edit,
  Camera,
  Loader2, // Loading spinner
  Feather, // Icon for "Create Profile"
  LogIn, // Icon for "Login"
} from 'lucide-react';

function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null); // Token ko save karne ke liye
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  // Form states
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [signupData, setSignupData] = useState({
    username: '',
    password: '',
    name: '',
    bio: '',
    avatar: 'https://images.pexels.com/photos/1704488/pexels-photo-1704488.jpeg?auto=compress&cs=tinysrgb&w=150',
  });

  // App states
  const [activeTab, setActiveTab] = useState('home');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeMessageId, setActiveMessageId] = useState(null); 
  const longPressTimer = useRef(null);
  const [trendingTags, setTrendingTags] = useState([]);
  
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', bio: '' });
  const [showUserListModal, setShowUserListModal] = useState(false); // Modal kholne ke liye
  const [modalType, setModalType] = useState(''); // 'followers' ya 'following' pata karne ke liye
  const [modalUsers, setModalUsers] = useState([]); // List store karne ke liye
  const [isLoadingList, setIsLoadingList] = useState(false); // Loading dikhane ke liye

  const fileInputRef = useRef(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [authError, setAuthError] = useState(null); // Login/Signup error ke liye

  const API_BASE_URL ='http://localhost:8000';

  // Initial data fetching
  
 // 1. Session Restore (Refresh handle karne ke liye)
 useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (storedToken && storedUser) {
    setToken(storedToken);
    setCurrentUser(JSON.parse(storedUser));
    setIsLoggedIn(true);
  }
}, []);
 // Ye sirf ek baar chalega jab page load hoga
 useEffect(() => {
  // Agar chat khuli hai (selectedChat) aur us bande ka koi unread message hai
  if (selectedChat && currentUser) {
    const hasUnreadInCurrentChat = messages.some(
      (msg) => 
        msg.sender_id === selectedChat && 
        msg.receiver_id === currentUser.id && 
        !msg.is_read // Agar unread hai
    );

    // Toh turant Read mark karo
    if (hasUnreadInCurrentChat) {
      // console.log("Auto-reading messages for open chat...");
      markMessagesAsRead(selectedChat);
    }
  }
}, [messages, selectedChat, currentUser])
useEffect(() => {
  // Agar banda logged in hai, tabhi check karo
  if (token && isLoggedIn) {
    
    const intervalId = setInterval(() => {
      // Har 2 second mein ye functions chupchap run honge
      fetchMessages();       
      fetchNotifications();
      // fetchUsers(); // Agar users ka status (online/offline) chahiye toh ye bhi uncomment kar dena
    }, 100); // 2000 ms = 2 Seconds

    // Cleanup: Jab banda logout kare ya page band kare, toh timer rok do
    return () => clearInterval(intervalId);
  }
}, [token, isLoggedIn]);

// 2. Data Fetching (Login & Refresh dono handle karne ke liye)
useEffect(() => {
  // Ye tab chalega jab bhi 'token' ki value aayegi ya badlegi
  if (token) {
    console.log("Token detected! Fetching data...");
    
    // Saara data parallel mein mangwa lo
    Promise.all([
       fetchUsers(), // Ab ye chalega jaise hi login hoga
       fetchPosts(),
       fetchNotifications(),
       fetchMessages(),
       fetchTrending()
    ]).catch(error => {
        console.error("Error syncing data:", error);
    });
  }
}, [token]);
 // <--- MAGIC FIX: Ye [token] zaruri hai
 const formatTime = (dateString) => {
  if (!dateString) return "";
  try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
      return "";
  }
};
const handleMouseDown = (id) => {
  // 500ms (aadha second) hold karne par menu khulega
  longPressTimer.current = setTimeout(() => {
    setActiveMessageId(id);
  }, 500);
};

const handleMouseUp = () => {
  // Agar jaldi chhod diya, toh timer cancel karo (normal click mana jayega)
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
  }
};
  const getAuthHeaders = () => {
    // State ki jagah directly LocalStorage se token lo
    const storedToken = localStorage.getItem('token');
    
    // Console mein print karo taaki pata chale kya ja raha hai
    // console.log("Sending Token to Backend:", storedToken); 

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${storedToken}`
    };
  };

  // App.js ke andar fetchPosts function dhundo
  const fetchUserList = async (userId, type) => {
    setModalType(type); // 'followers' or 'following'
    setShowUserListModal(true); // Modal kholo
    setModalUsers([]); // Purana data saaf karo
    setIsLoadingList(true); // Loading shuru

    try {
      // Backend URL: /users/1/followers ya /users/1/following
      const response = await fetch(`${API_BASE_URL}/users/${userId}/${type}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      
      // Data mapping (Backend -> Frontend)
      const formattedUsers = data.map(user => ({
        ...user,
        avatar: user.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        // Backend se 'is_following' aa raha hai, usse use karenge button ke liye
      }));

      setModalUsers(formattedUsers);
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
    } finally {
      setIsLoadingList(false); // Loading khatam
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const rawData = await response.json();
      console.log("API Data:", rawData);
      
      const formattedPosts = rawData.map((post) => {
        const owner = post.owner || {}; 
        
        return {
          ...post,
          user_avatar: owner.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          user_username: owner.username || "Unknown User",
          
          likes_count: post.likes_count || 0,
          
          // --- YAHAN GALTI THI (FIXED) ---
          // Backend bhej raha hai 'comment_count' (Singular)
          // Hum usse UI ke variable 'comments_count' mein daal rahe hain
          comments_count: post.comment_count || 0, 
          // --------------------------------
          
          is_liked: post.is_liked || false,
        };
      });

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setPosts([]);
    }
  };
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      const rawData = await response.json();
      
      // --- MAPPING FIX ---
      // Backend bhejta hai 'image_url', Frontend dhundta hai 'avatar'
      const formattedUsers = rawData.map(user => ({
        ...user,
        avatar: user.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        // Baaki fields same rahenge
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

 // --- FETCH NOTIFICATIONS ---
 const fetchNotifications = async () => {
  try {
    // Note: Ab hum URL '/notifications' use kar rahe hain (Backend se match)
    const response = await fetch(`${API_BASE_URL}/notifications`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    // Data map karke state mein daalo
    setNotifications(data.map(n => ({
      ...n,
      // Backend se 'sender_avatar' aa raha hai, frontend 'user_avatar' use karta hai UI mein
      is_read: n.is_read,
      user_avatar: n.sender_avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
      user_username: n.sender_name
    })));
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    // setNotifications([]); // Error aaye to empty mat karo, purana dikhne do
  }
};

// --- MARK AS READ FUNCTION (New) ---
// Notification Read Handler
const markNotificationAsRead = async (notifId) => {
  // 1. UI update (Turant grey/read dikhane ke liye)
  setNotifications(prev => prev.map(n => 
    n.id === notifId ? { ...n, is_read: true } : n
  ));

  // 2. Backend update (Taaki refresh par wapas blue na ho)
  try {
    await fetch(`${API_BASE_URL}/notifications/${notifId}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
  } catch (error) {
    console.error("Error marking notification read:", error);
  }
};

// --- HANDLE CLICK (Navigation + Read) ---
const handleNotificationClick = (notif) => {
  // Read mark karo
  if (!notif.is_read) {
      markNotificationAsRead(notif.id);
  }

  // Navigation Logic
  if (notif.type === 'follow') {
      // Agar follow notification hai, to us user ki profile kholo
      // Humein user object chahiye, par notification mein sirf ID aur Name hai.
      // Quick fix: Ek dummy user object bana ke open karte hain, ya fetch karte hain.
      // Abhi ke liye simple alert ya kuch nahi karte, bas read mark kaafi hai.
      // Future mein: fetchUserById(notif.sender_id).then(user => setSelectedUser(user));
  }
};
const handleDeleteMessage = async (msgId) => {
  try {
    console.log("Deleting message:", msgId); // Debugging ke liye

    const response = await fetch(`http://localhost:8000/delete/${msgId}/message`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      // UI se message turant hatao
      setMessages((prev) => prev.filter((msg) => msg.id !== msgId));
      setActiveMessageId(null); // Menu band karo
      console.log("Deleted successfully");
    } else {
      console.error("Failed to delete, Status:", response.status);
    }
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

const fetchMessages = async () => {
  if (!token) return;
  try {
    // 👇👇 IN DONO LINES KO DELETE KAR DO YA COMMENT KAR DO
    // console.log("Sending Token to Backend:", token); 
    
    const response = await fetch("http://localhost:8000/messages", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (response.ok) {
      const data = await response.json();
      setMessages(data);
      // 👇👇 ISKO BHI HATA DO
      // console.log("Fetched Messages from Server:", data); 
    }
  } catch (error) {
    console.error("Error fetching messages:", error);
  }
};
  const fetchTrending = async () => {
    setIsLoadingTrending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/trending`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setTrendingTags(data);
    } catch (error) {
      console.error('Error fetching trending tags:', error);
      setTrendingTags([]);
    } finally {
      setIsLoadingTrending(false);
    }
  };

  // --- Authentication Functions ---

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      setAuthError("Username and password are required.");
      return;
    }
    setIsPosting(true);
    setAuthError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        throw new Error('Invalid username or password');
      }
      
      const data = await response.json(); 
      
      // FIX 3: ASLI FIX YEH HAI (Backend se flat object aa raha hai)
      const { access_token, token_type, ...userData } = data;
      setCurrentUser(userData);
      setToken(access_token);
      setIsLoggedIn(true);

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
    } catch (error) {
      console.error('Error logging in:', error);
      setAuthError(error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupData.username || !signupData.password || !signupData.name) {
      setAuthError("Name, Username, and Password are required.");
      return;
    }
    
    setIsPosting(true);
    setAuthError(null);

    // 👇👇 YE RAHA PAYLOAD DEFINITION 👇👇
    const payloadToSend = {
      username: signupData.username,
      password: signupData.password,
      name: signupData.name,
      bio: signupData.bio,
      // Frontend 'avatar' use kar raha hai, Backend 'image_url' expect karta hai
      image_url: signupData.avatar, 
    };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
      });

      if (!response.ok) {
         const err = await response.json();
         throw new Error(err.detail || 'Signup failed.');
      }
      
      const data = await response.json(); 
      const { access_token, token_type, ...userData } = data;
      
      // 1. LocalStorage Update
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // 2. State Update
      setCurrentUser(userData);
      setToken(access_token);
      setIsLoggedIn(true);
      
      // 3. Page Reload (Taaki posts turant dikh jayein)
      window.location.reload();
      
    } catch (error) {
      console.error('Error signing up:', error);
      setAuthError(error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!editFormData.name) {
      alert("Name cannot be empty.");
      return;
    }
    setIsPosting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editFormData),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const updatedUser = await response.json();
      
      setCurrentUser(updatedUser);
      setEditProfile(false);
      
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setToken(null);
    setIsLoggedIn(false);
    setPosts([]);
    setUsers([]);
    setNotifications([]);
    setMessages([]);
    setTrendingTags([]);
    setActiveTab('home');
    setAuthMode('login');
    setAuthError(null);
  };

  // --- Other App Functions (Create, Like, Comment, etc.) ---

  const createPost = async () => {
    // 1. Validation
    if (!newPostContent.trim() || isPosting) return;

    // 2. Token Security: Token direct storage se uthao (State ka wait mat karo)
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      alert("Please login first!");
      return;
    }

    setIsPosting(true);

    const postToSend = {
      content: newPostContent,
      // Backend 'image_url' expect kar raha hai ya 'image', us hisab se bhejein
      // Agar backend mapping handle kar raha hai to 'image' thik hai
      image: newPostImage || null, 
    };

    try {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}` // Direct token use kiya
        },
        body: JSON.stringify(postToSend),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const newPostFromDB = await response.json();

      // --- ASLI JADU YAHAN HAI (THE FIX) ---
      // Hum backend se aaye data ko apne UI ke format mein badal rahe hain.
      // Photo aur Naam hum 'currentUser' state se le rahe hain.
      
      const formattedNewPost = {
        ...newPostFromDB, // ID, Content, CreatedAt wahan se aaya
        
        // Photo aur Naam turant dikhane ke liye Current User ka data use karo
        user_avatar: currentUser?.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        user_username: currentUser?.username || "Me",
        
        // Default values taaki buttons sahi dikhein
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        
        // Owner object bhi bana dete hain safety ke liye
        owner: {
            username: currentUser?.username,
            image_url: currentUser?.image_url
        }
      };

      // Ab formatted post ko list mein sabse upar add karo
      setPosts([formattedNewPost, ...posts]);
      
      // Cleanup
      setNewPostContent('');
      setNewPostImage('');
      setShowNewPost(false);

    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsPosting(false);
    }
  };
  const toggleLike = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const updatedPostData = await response.json();
      
      // State update karein: Sirf us post ko update karein jisne like kiya
      setPosts(
        posts.map((post) =>
          post.id === updatedPostData.id 
          ? { ...post, ...updatedPostData } // Purane data ko naye se replace
          : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const toggleBookmark = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const updatedPost = await response.json();
      setPosts(
        posts.map((post) =>
          post.id === updatedPost.id ? updatedPost : post
        )
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const openComments = async (post) => {
    setSelectedPost(post);
    setComments([]); // Pehle purane comments saaf karo
    setIsLoadingComments(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${post.id}/comments`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Network response was not ok');
      const rawData = await response.json();
      
      // --- MAPPING FIX ---
      const formattedComments = rawData.map(comment => ({
        ...comment,
        // Backend 'owner' object bhej raha hai, UI flat fields chahta hai
        user_avatar: comment.owner.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        user_username: comment.owner.username,
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };
  const addComment = async () => {
    if (!newComment.trim() || !selectedPost) return;

    const commentToSend = {
      content: newComment,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${selectedPost.id}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(commentToSend),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const newCommentFromDB = await response.json();
      
      // --- MAPPING FIX (Instant Update) ---
      const formattedNewComment = {
        ...newCommentFromDB,
        // Abhi current user ne comment kiya hai, to uska data use karo
        user_avatar: currentUser?.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        user_username: currentUser?.username || "Me"
      };

      setComments([...comments, formattedNewComment]); // List mein add karo
      
      // Post ke comment count ko bhi update karo (+1)
      setPosts(
        posts.map((post) =>
          post.id === selectedPost.id 
            ? { ...post, comments_count: (post.comments_count || 0) + 1 } 
            : post
        )
      );
      setNewComment('');

    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };
  const followUser = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      
      // FIX 1: Pehle data variable mein lo, phir destructure karo (Ya seedha use karo)
      const data = await response.json();
      const { updated_target_user, updated_current_user } = data;

      // 1. Users List Update karo
      setUsers(prevUsers => 
        prevUsers.map((user) =>
          user.id === updated_target_user.id 
          ? { ...user, ...updated_target_user } // Merge new data
          : user
        )
      );

      // 2. Agar Profile/Modal khula hai to wahan bhi update karo
      // FIX 2: Duplicate logic hata diya aur sahi variable use kiya
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(prev => ({ 
            ...prev, 
            ...updated_target_user 
        }));
      }
      
      // 3. Current User (Apna khud ka count) update karo
      setCurrentUser(prev => ({
          ...prev,
          ...updated_current_user
      })); 

      // Optional: LocalStorage bhi update kar do taaki refresh pe count na uday
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
          storedUser.following = updated_current_user.following;
          localStorage.setItem('user', JSON.stringify(storedUser));
      }

    } catch (error) {
      console.error('Error following user:', error);
    }
  };
  
  // --- COUNTER UPDATE LOGIC ---
  // --- MARK MESSAGES AS READ (Frontend + Backend) ---
  const markMessagesAsRead = async (senderId) => {
    
    // 1. UI Update (Turant Counter kam karne ke liye)
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.sender_id === senderId && msg.receiver_id === currentUser.id
          ? { ...msg, is_read: true }
          : msg
      )
    );

    // 2. Backend API Call (Database mein save karne ke liye)
    try {
      await fetch(`${API_BASE_URL}/messages/${senderId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };
  const sendMessage = async () => {
    if (!newMessage.trim() || selectedChat === null) return;

    // Backend schema expect kar raha hai: receiver_id aur content
    const messageToSend = {
      receiver_id: selectedChat, // Jisse chat kar rahe ho uska ID
      content: newMessage,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(messageToSend),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const newMessageFromDB = await response.json();
      
      // UI mein turant add karo
      setMessages([...messages, newMessageFromDB]);
      setNewMessage(''); // Input clear karo

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // --- Derived State & Event Handlers ---

  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };
  const handleSignupChange = (e) => {
    setSignupData({ ...signupData, [e.target.name]: e.target.value });
  };
  const handleEditFormChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };
  
  const openEditModal = () => {
    if (!currentUser) return; // Ab yeh 100% chalega
    setEditFormData({ name: currentUser.name, bio: currentUser.bio });
    setEditProfile(true);
  };

  const filteredUsers = (isLoggedIn && searchQuery.trim() !== "") ? users.filter(
    (user) =>
      user.id !== currentUser.id && (
        (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
  ) : [];

  const chatUsers = isLoggedIn ? users.filter((user) =>
    user.id !== currentUser.id &&
    messages.some((msg) => 
        (msg.sender_id === user.id || msg.receiver_id === user.id) // ✅ sender_id use karo
    )
  ) : [];

  const selectedChatMessages = isLoggedIn ? messages.filter(
    (msg) =>
      (msg.sender_id === currentUser.id && msg.receiver_id === selectedChat) ||
      (msg.sender_id === selectedChat && msg.receiver_id === currentUser.id)
  ) : [];

  const unreadNotifications = notifications.filter((n) => !n.is_read).length; 
  // --- COUNTER LOGIC (Flexible Fix) ---
  const totalUnreadMessages = currentUser 
    ? messages.filter((msg) => {
        // 1. Check karo message mere liye hai (Double '==' use karo taaki string/int match ho jaye)
        const isForMe = msg.receiver_id == currentUser.id;
        
        // 2. Unread check: '!msg.is_read' use karo
        // Ye (false, 0, null) sabko "Unread" maanega aur counter dikhayega
        const isUnread = !msg.is_read;
        
        return isForMe && isUnread;
      }).length
    : 0;
  
  
  
  // --- RENDER LOGIC ---

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8">
          
          {authMode === 'login' && (
            <>
              <div className="flex flex-col items-center mb-6">
                <span className="p-3 bg-blue-100 text-blue-600 rounded-full">
                  <LogIn className="w-8 h-8" />
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mt-4">Welcome Back</h2>
                <p className="text-gray-500 text-sm mt-1">Log in to your SocialHub account.</p>
              </div>
          
              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={loginData.username}
                    onChange={handleLoginChange}
                    placeholder="@johndoe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {authError && <p className="text-sm text-red-600">{authError}</p>}
                
                <button 
                  type="submit"
                  disabled={isPosting}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
                </button>

                <p className="text-sm text-center text-gray-500">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => { setAuthMode('signup'); setAuthError(null); }} className="font-semibold text-blue-600 hover:underline">
                    Signup
                  </button>
                </p>
              </form>
            </>
          )}

          {authMode === 'signup' && (
            <>
              <div className="flex flex-col items-center mb-6">
                <span className="p-3 bg-blue-100 text-blue-600 rounded-full">
                  <Feather className="w-8 h-8" />
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mt-4">Create Your Profile</h2>
                <p className="text-gray-500 text-sm mt-1">Join SocialHub to connect with the world.</p>
              </div>
              
              <form className="space-y-4" onSubmit={handleSignup}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={signupData.name}
                    onChange={handleSignupChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={signupData.username}
                    onChange={handleSignupChange}
                    placeholder="@johndoe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                 <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={signupData.password}
                    onChange={handleSignupChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                  <textarea
                    name="bio"
                    value={signupData.bio}
                    onChange={handleSignupChange}
                    placeholder="Software Developer | Tech Enthusiast"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Avatar URL</label>
                  <input
                    type="text"
                    name="avatar"
                    value={signupData.avatar}
                    onChange={handleSignupChange}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {authError && <p className="text-sm text-red-600">{authError}</p>}

                <button 
                  type="submit"
                  disabled={isPosting}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Profile & Sign Up'}
                </button>

                <p className="text-sm text-center text-gray-500">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setAuthMode('login'); setAuthError(null); }} className="font-semibold text-blue-600 hover:underline">
                    Login
                  </button>
                </p>
              </form>
            </>
          )}

        </div>
      </div>
    );
  }
  
  // ===============================================
  // AGAR LOGGED IN HAI
  // ===============================================
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto flex">
        <aside className="w-64 h-screen sticky top-0 border-r border-gray-200 bg-white p-4 hidden md:block">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-blue-600">SocialHub</h1>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition ${
                activeTab === 'home' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-lg font-medium">Home</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition ${
                activeTab === 'search' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <Search className="w-6 h-6" />
              <span className="text-lg font-medium">Search</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition relative ${
                activeTab === 'notifications' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <Bell className="w-6 h-6" />
              <span className="text-lg font-medium">Notifications</span>
              {unreadNotifications > 0 && (
                <span className="absolute top-2 left-8 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* Messages Tab Button with Counter */}
            {/* Messages Tab Button with Counter */}
            <button
              onClick={() => {
                setActiveTab('messages');
                setSelectedChat(null); // 👈 YE LINE MAGIC KAREGI (Chat band, List Open)
              }}
              className={`flex items-center space-x-4 px-4 py-3 rounded-lg transition ${
                activeTab === 'messages' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <div className="relative">
                <Mail className="w-6 h-6" />
                
                {/* Counter Badge */}
                {totalUnreadMessages > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {totalUnreadMessages}
                  </span>
                )}
              </div>
              <span className="text-lg font-medium">Messages</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition ${
                activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <User className="w-6 h-6" />
              <span className="text-lg font-medium">Profile</span>
            </button>
          </nav>

          <button
            onClick={() => setShowNewPost(true)}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-full font-semibold hover:bg-blue-700 transition"
          >
            Post
          </button>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer">
              {/* FIX 5: image_url kar diya */}
              <img src={currentUser?.image_url} alt="User" className="w-10 h-10 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{currentUser?.name}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser?.username}</p>
              </div>
              <button onClick={handleLogout} title="Logout">
                <LogOut className="w-5 h-5 text-gray-500 hover:text-red-500" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 border-r border-gray-200 bg-white min-h-screen max-w-2xl">
          {activeTab === 'home' && (
            <div>
              <div className="border-b border-gray-200 p-4 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold">Home</h2>
              </div>
              
              {isLoading ? (
                <div className="p-8 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : posts.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">
                   No posts found. Follow users to see their posts here.
                 </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {posts.map((post) => (
                    <div key={post.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex space-x-3">
                      <img 
  src={post.user_avatar} 
  alt="User" 
  className="w-12 h-12 rounded-full cursor-pointer hover:opacity-80 transition"
  onClick={(e) => {
    e.stopPropagation(); // Taaki post open na ho, sirf profile khule
    setSelectedUser({
       id: post.user_id || post.owner?.id, 
       name: post.user_username, 
       username: post.user_username, 
       avatar: post.user_avatar,
       ...post.owner
    });
  }}
/>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{post.user_username}</span>
                            <span className="text-gray-500 text-sm">{post.created_at}</span>
                          </div>
                          <p className="mt-2 text-gray-800">{post.content}</p>
                          {post.image_url && (
                            <img
                              src={post.image_url}
                              alt="Post"
                              className="mt-3 rounded-2xl w-full max-h-96 object-cover"
                            />
                          )}
                          <div className="flex items-center justify-between mt-4 text-gray-500">
                            <button
                              onClick={() => toggleLike(post.id)}
                              className="flex items-center space-x-2 hover:text-red-500 transition"
                            >
                              <Heart
                                className={`w-5 h-5 ${post.is_liked ? 'fill-red-500 text-red-500' : ''}`}
                              />
                              <span>{post.likes_count}</span>
                            </button>
                            <button
                              onClick={() => openComments(post)}
                              className="flex items-center space-x-2 hover:text-blue-500 transition"
                            >
                              <MessageCircle className="w-5 h-5" />
                              <span>{post.comments_count}</span>
                            </button>
                            <button className="flex items-center space-x-2 hover:text-green-500 transition">
                              <Share2 className="w-5 h-5" />
                              <span>{post.shares_count || 0}</span>
                            </button>
                            <button
                              onClick={() => toggleBookmark(post.id)}
                              className="hover:text-blue-500 transition"
                            >
                              <Bookmark
                                className={`w-5 h-5 ${post.is_bookmarked ? 'fill-blue-500 text-blue-500' : ''}`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

{activeTab === 'search' && (
            <div>
              <div className="border-b border-gray-200 p-4 sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Search results */}
              <div className="divide-y divide-gray-200">
                {filteredUsers.length === 0 && searchQuery.trim() !== "" ? (
                   <div className="p-8 text-center text-gray-500">No users found.</div>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        
                        {/* User Info (Clickable -> Opens Profile) */}
                        <div
                          className="flex items-center space-x-3 flex-1 cursor-pointer"
                          onClick={() => setSelectedUser(user)}
                        >
                          <img 
                            src={user.avatar || user.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                            alt="User" 
                            className="w-12 h-12 rounded-full object-cover" 
                          />
                          <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.username}</p>
                            
                            {/* Followers Count */}
                            <p className="text-xs text-gray-500 mt-1">
                              {user.followers} followers
                            </p>
                          </div>
                        </div>

                        {/* Follow/Unfollow/Follow Back Button */}
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={(e) => {
                                e.stopPropagation(); // Parent click ko rokne ke liye (taaki profile na khule)
                                followUser(user.id);
                            }}
                            className={`px-4 py-2 rounded-full font-semibold transition ${
                              user.is_following
                                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' // Following (Grey)
                                : 'bg-blue-600 text-white hover:bg-blue-700'    // Follow / Follow Back (Blue)
                            }`}
                          >
                            {/* TEXT LOGIC */}
                            {user.is_following 
                                ? 'Following' 
                                : user.follows_you 
                                    ? 'Follow Back' 
                                    : 'Follow'
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === 'notifications' && (
            <div>
              <div className="border-b border-gray-200 p-4 sticky top-0 bg-white z-10 flex justify-between items-center">
                <h2 className="text-xl font-bold">Notifications</h2>
                {unreadNotifications > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-semibold">
                        {unreadNotifications} New
                    </span>
                )}
              </div>

              {isLoading ? (
                  <div className="p-8 flex justify-center items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="bg-gray-100 p-4 rounded-full mb-4">
                    <Bell className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">No notifications yet</h3>
                  <p className="text-gray-500">When someone likes or follows you, it'll show up here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationAsRead(notif.id)}
                      className={`p-4 hover:bg-gray-50 transition cursor-pointer flex items-start space-x-4 ${
                        !notif.is_read ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Icon based on Type */}
                      <div className="mt-1">
                        {notif.type === 'like' && (
                            <div className="p-2 bg-red-100 rounded-full">
                                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                            </div>
                        )}
                        {notif.type === 'follow' && (
                            <div className="p-2 bg-blue-100 rounded-full">
                                <UserPlus className="w-4 h-4 text-blue-600" />
                            </div>
                        )}
                        {notif.type === 'comment' && (
                            <div className="p-2 bg-green-100 rounded-full">
                                <MessageCircle className="w-4 h-4 text-green-600" />
                            </div>
                        )}
                      </div>

                      <div className="flex-1">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                            <img 
                            src={notif.user_avatar} 
                            alt="User" 
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 cursor-pointer hover:opacity-80"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser({
                                    id: notif.sender_id,
                                    name: notif.user_username, 
                                    username: notif.user_username,
                                    avatar: notif.user_avatar
                                });
                            }}
                        />
                                <p className="text-sm text-gray-900">
                                    <span className="font-bold hover:underline">{notif.user_username}</span>
                                    <span className="text-gray-600 ml-1">{notif.content}</span>
                                </p>
                            </div>
                            {!notif.is_read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            )}
                         </div>
                         <p className="text-xs text-gray-400 mt-1 ml-10">
                            {new Date(notif.created_at).toLocaleDateString()} • {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'messages' && (
            <div className="flex flex-col h-screen">
              <div className="border-b border-gray-200 p-4 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold">Messages</h2>
              </div>
              
              {!selectedChat ? (
                // Chat List
                <div>
                  {chatUsers.length === 0 ? (
                     <div className="p-8 text-center text-gray-500">
                       No messages. Start a conversation from a user's profile.
                     </div>
                  ) : (
                    <div className="space-y-2">
                    {chatUsers.map((user) => {
                      
                      // 👇 Logic: Is specific user ke unread messages gino
                      const unreadCount = messages.filter(
                        (msg) => 
                          msg.sender_id === user.id &&       // Isne bheja ho
                          msg.receiver_id === currentUser.id && // Mujhe bheja ho
                          !msg.is_read                       // Aur padha na ho
                      ).length;
  
                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            setSelectedChat(user.id);    // Chat open
                            markMessagesAsRead(user.id); // Read mark
                          }}
                          className={`flex items-center p-3 rounded-xl cursor-pointer transition ${
                            selectedChat === user.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="relative">
                            <img src={user.avatar} alt="User" className="w-12 h-12 rounded-full object-cover" />
                            {/* Online indicator (Optional, future ke liye) */}
                            {/* <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span> */}
                          </div>
                          
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className={`font-semibold truncate ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                {user.name}
                              </p>
                              
                              {/* 👇 Time Display (Latest Message ka) */}
                              <span className="text-xs text-gray-400">
                                {/* Yahan aap last message ka time dikha sakte ho agar chaho */}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center mt-1">
                              <p className={`text-sm truncate w-32 ${unreadCount > 0 ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                                 @{user.username}
                              </p>
  
                              {/* 👇👇 MAGIC: UNREAD COUNT BADGE 👇👇 */}
                              {unreadCount > 0 && (
                                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              ) : (
                // Chat Window
                // Chat Window
              <div className="flex-1 flex flex-col">
                
              {/* 👇👇 YE HEADER REPLACE KARO (FIXED CODE) 👇👇 */}
              <div className="border-b border-gray-200 p-4 flex items-center space-x-3 sticky top-0 bg-white z-10">
                    <button 
                      onClick={() => setSelectedChat(null)} 
                      className="p-1 mr-2 hover:bg-gray-100 rounded-full transition"
                    >
                       <X className="w-6 h-6" /> {/* Agar X icon chahiye ya back arrow */}
                    </button>
                    
                    <div 
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition flex-1"
                      onClick={() => {
                          const chatUser = users.find((u) => u.id === selectedChat);
                          if (chatUser) setSelectedUser(chatUser);
                      }}
                    >
                      <img
                        src={users.find((u) => u.id === selectedChat)?.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                        alt="User"
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {users.find((u) => u.id === selectedChat)?.name || "User"}
                        </p>
                        <p className="text-xs text-blue-500">
                          
                        </p>
                      </div>
                    </div>
              </div>
              {/* 👆👆 HEADER END 👆👆 */}

              {/* ... Baaki ka chat window code same rahega ... */}

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedChatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex mb-6 ${ // Gap badhaya thoda (mb-6) taaki menu overlap na kare
                          msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Message Bubble Container */}
                        <div className="relative group"> 
                          
                          {/* 1. ACTUAL MESSAGE BUBBLE */}
                          <div
                            onMouseDown={() => handleMouseDown(msg.id)} // Mouse hold start
                            onMouseUp={handleMouseUp}                   // Mouse release
                            onTouchStart={() => handleMouseDown(msg.id)} // Mobile Touch start
                            onTouchEnd={handleMouseUp}                   // Mobile Touch end
                            onContextMenu={(e) => e.preventDefault()}    // Right click menu roko
                            className={`max-w-xs px-4 py-2 rounded-2xl cursor-pointer select-none transition ${
                              msg.sender_id === currentUser?.id
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-gray-200 text-gray-800 rounded-bl-none'
                            }`}
                          >
                            <p>{msg.content}</p>
                          </div>

                          {/* 2. HIDDEN MENU (Jo Long Press pe dikhega) */}
                          {activeMessageId === msg.id && (
                            <div 
                              className={`absolute top-full mt-1 p-2 bg-white shadow-xl border border-gray-100 rounded-lg z-10 flex flex-col gap-1 min-w-[120px] ${
                                msg.sender_id === currentUser?.id ? 'right-0' : 'left-0'
                              }`}
                            >
                              {/* Time Show Karo */}
                              <div className="text-xs text-gray-500 font-medium border-b border-gray-100 pb-1 mb-1 text-center">
                                {formatTime(msg.created_at)}
                              </div>

                              {/* Delete Button (Sirf mere msg ke liye) */}
                              {msg.sender_id === currentUser?.id && (
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="flex items-center justify-center text-red-500 text-xs font-bold hover:bg-red-50 py-1 rounded transition"
                                >
                                  Delete
                                </button>
                              )}
                              
                              {/* Close Button (Agar galti se khul gaya) */}
                              <button
                                onClick={() => setActiveMessageId(null)}
                                className="text-[10px] text-gray-400 hover:text-gray-600 pt-1"
                              >
                                Close
                              </button>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 p-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={sendMessage}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


{activeTab === 'profile' && (
            <div>
              <div className="relative">
                {/* Cover Image */}
                <div className="h-48 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                
                {/* Profile Image with Fallback */}
                <img
                  src={currentUser?.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                  alt="Profile"
                  className="absolute -bottom-16 left-4 w-32 h-32 rounded-full border-4 border-white bg-white"
                />
              </div>

              <div className="mt-20 px-4">
                <div className="flex justify-between items-start">
                  
                  {/* Left Side: Name, Bio, Counts */}
                  <div>
                    <h2 className="text-2xl font-bold">{currentUser?.name}</h2>
                    <p className="text-gray-500">{currentUser?.username}</p>
                    <p className="mt-3 text-gray-700">{currentUser?.bio}</p>
                    
                    {/* Counts Section (Clickable) */}
                    <div className="flex space-x-6 mt-4">
                      {/* Following */}
                      <button 
                        onClick={() => fetchUserList(currentUser.id, 'following')}
                        className="flex items-center hover:underline focus:outline-none cursor-pointer"
                      >
                        <span className="font-bold">{currentUser?.following || 0}</span>
                        <span className="text-gray-500 ml-1">Following</span>
                      </button>

                      {/* Followers */}
                      <button 
                        onClick={() => fetchUserList(currentUser.id, 'followers')}
                        className="flex items-center hover:underline focus:outline-none cursor-pointer"
                      >
                        <span className="font-bold">{currentUser?.followers || 0}</span>
                        <span className="text-gray-500 ml-1">Followers</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Right Side: Edit & Logout Buttons (FIXED COLORS) */}
                  <div className="flex space-x-2">
                    <button 
                        onClick={openEditModal} 
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-full font-semibold hover:bg-gray-300 transition"
                    >
                        Edit Profile
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-full font-semibold hover:bg-red-100 transition"
                    >
                        Logout
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Profile Posts Section */}
              <div className="mt-8 border-t border-gray-200">
                <div className="divide-y divide-gray-200">
                  {posts.filter((p) => p.user_id === currentUser?.id).length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      You haven't posted anything yet.
                    </div>
                  ) : (
                    posts.filter((p) => p.user_id === currentUser?.id).map((post) => (
                      <div key={post.id} className="p-4 hover:bg-gray-50 transition">
                        <div className="flex space-x-3">
                          <img 
                            src={post.owner?.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                            alt="User" 
                            className="w-12 h-12 rounded-full" 
                          />
                          <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold">{post.owner?.username}</span>
                                <span className="text-gray-500 text-sm">
                                    {new Date(post.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="mt-2 text-gray-800">{post.content}</p>
                              {post.image_url && (
                                <img
                                  src={post.image_url}
                                  alt="Post"
                                  className="mt-3 rounded-2xl w-full max-h-96 object-cover"
                                />
                              )}
                              <div className="flex items-center justify-between mt-4 text-gray-500">
                                <span className="flex items-center space-x-2">
                                  <Heart className="w-5 h-5" />
                                  <span>{post.likes_count}</span>
                                </span>
                                <span className="flex items-center space-x-2">
                                  <MessageCircle className="w-5 h-5" />
                                  <span>{post.comment_count}</span>
                                </span>
                                <span className="flex items-center space-x-2">
                                  <Share2 className="w-5 h-5" />
                                  <span>0</span>
                                </span>
                              </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          </main>

          <aside className="w-80 p-4 bg-white hidden lg:block h-screen sticky top-0 overflow-y-auto">
          
          {/* Who to follow Section */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h3 className="font-bold text-lg mb-4">Who to follow</h3>
            
            {isLoading ? (
                <div className="p-4 flex justify-center items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            ) : (
              <div className="space-y-4">
                {users
                  .filter(u => u.id !== currentUser?.id) // Khud ko list se hatao
                  .slice(0, 5) // Sirf top 5 users dikhao
                  .map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    
                    {/* User Info (Clickable) */}
                    <div 
                        className="flex items-center space-x-3 cursor-pointer overflow-hidden"
                        onClick={() => setSelectedUser(user)}
                    >
                      <img 
                        src={user.avatar || user.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                        alt="User" 
                        className="w-10 h-10 rounded-full bg-gray-200 object-cover flex-shrink-0" 
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                      </div>
                    </div>

                    {/* Follow/Follow Back Button */}
                    <button
                      onClick={() => followUser(user.id)}
                      className={`ml-2 px-3 py-1 text-xs rounded-full font-semibold transition flex-shrink-0 ${
                        user.is_following
                          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' // Following (Grey)
                          : 'bg-blue-600 text-white hover:bg-blue-700'    // Follow/Follow Back (Blue)
                      }`}
                    >
                      {user.is_following 
                        ? 'Following' 
                        : user.follows_you 
                            ? 'Follow Back' 
                            : 'Follow'
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trending Section */}
          <div className="bg-gray-50 rounded-2xl p-4 mt-4">
            <h3 className="font-bold text-lg mb-4">Trending</h3>
            {isLoadingTrending ? (
               <div className="p-4 flex justify-center items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            ) : trendingTags.length === 0 ? (
               <p className="text-gray-500 text-sm">No trending topics.</p>
            ) : (
              <div className="space-y-4">
                {trendingTags.map((tag) => (
                  <div key={tag.id} className="cursor-pointer hover:bg-gray-100 p-2 rounded transition">
                    <p className="text-xs text-gray-500">Trending</p>
                    <p className="font-semibold text-sm">#{tag.name}</p>
                    <p className="text-xs text-gray-500">{tag.post_count} posts</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-6 px-2 text-xs text-gray-400">
            <p>© 2024 SocialHub. All rights reserved.</p>
          </div>
        </aside>
      
      {/* --- Modals --- */}

      {showNewPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Create Post</h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewPost(false);
                  setNewPostContent('');
                  setNewPostImage('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex space-x-3">
              {/* FIX 9: 'avatar' ko 'image_url' kiya */}
              <img src={currentUser?.image_url} alt="User" className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full resize-none focus:outline-none text-lg"
                  rows={4}
                />
                {newPostImage && (
                  <div className="relative mt-3">
                    <img
                      src={newPostImage}
                      alt="Preview"
                      className="rounded-2xl w-full max-h-96 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setNewPostImage('')}
                      className="absolute top-2 right-2 bg-gray-800 bg-opacity-75 text-white rounded-full p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = prompt('Enter image URL:');
                    if (url) setNewPostImage(url);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button type="button" className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition">
                  <Smile className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={createPost}
                disabled={!newPostContent.trim() || isPosting}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold">Comments</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedPost(null);
                  setComments([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <div className="flex space-x-3 mb-6">
                <img
                  src={selectedPost.user_avatar}
                  alt="User"
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{selectedPost.user_username}</span>
                    <span className="text-gray-500 text-sm">{selectedPost.created_at}</span>
                  </div>
                  <p className="mt-2 text-gray-800">{selectedPost.content}</p>
                  {selectedPost.image_url && (
                    <img
                      src={selectedPost.image_url}
                      alt="Post"
                      className="mt-3 rounded-2xl w-full max-h-96 object-cover"
                    />
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-4">
                {isLoadingComments ? (
                   <div className="p-8 flex justify-center items-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No comments yet. Be the first to comment!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      {/* 👇 UPDATED COMMENT IMAGE */}
                      <img
                        src={comment.user_avatar}
                        alt="User"
                        className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80"
                        onClick={() => setSelectedUser({
                            id: comment.user_id || comment.owner?.id,
                            name: comment.user_username,
                            username: comment.user_username,
                            avatar: comment.user_avatar,
                            ...comment.owner
                        })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {/* 👇 UPDATED COMMENT NAME */}
                          <span 
                            className="font-semibold text-sm cursor-pointer hover:underline"
                            onClick={() => setSelectedUser({
                                id: comment.user_id || comment.owner?.id,
                                name: comment.user_username,
                                username: comment.user_username,
                                avatar: comment.user_avatar,
                                ...comment.owner
                            })}
                          >
                            {comment.user_username}
                          </span>
                          <span className="text-gray-500 text-xs">{comment.created_at}</span>
                        </div>
                        <p className="mt-1 text-gray-800">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-auto">
              <div className="flex space-x-3">
                {/* FIX 10: 'avatar' ko 'image_url' kiya */}
                <img src={currentUser?.image_url} alt="User" className="w-10 h-10 rounded-full" />
                <div className="flex-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addComment()}
                    placeholder="Write a comment..."
                    className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addComment}
                    disabled={!newComment.trim()}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

     {/* --- USER PROFILE POPUP MODAL (Fixed Design + Follow Back Logic) --- */}
     {/* --- USER PROFILE POPUP MODAL --- */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/40 text-white rounded-full p-1 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Blue Cover Header */}
            <div className="h-32 bg-gradient-to-r from-blue-400 to-blue-600"></div>

            <div className="px-6 pb-6">
              <div className="relative flex justify-between items-end -mt-12 mb-4">
                
                {/* Profile Image */}
                <img
                  src={selectedUser.avatar || selectedUser.image_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                  alt="Profile"
                  className="w-24 h-24 rounded-full border-4 border-white bg-white object-cover"
                />
                
                {/* --- ACTION BUTTONS (Message + Follow) --- */}
                <div className="flex space-x-3 pb-2">
                    
                    {/* 1. Message Button (New) */}
                    {selectedUser.id !== currentUser?.id && (
                        <button
                        onClick={() => {
                            console.log("Starting chat with ID:", selectedUser.id); // Check Console
                            setSelectedChat(selectedUser.id);    // 1. Chat ID Set
                            markMessagesAsRead(selectedUser.id); // 2. Counter Reset
                            setActiveTab('messages');            // 3. Tab Switch
                            setSelectedUser(null);               // 4. Modal Close
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full font-semibold hover:bg-blue-100 transition"
                    >
                        <Mail className="w-4 h-4" />
                        <span>Messages</span>
                    </button>
                    )}

                    {/* 2. Follow Button */}
                    {selectedUser.id !== currentUser?.id && (
                      <button
                      onClick={() => followUser(selectedUser.id)}
                      className={`px-6 py-2 rounded-full font-bold transition shadow-sm ${
                          selectedUser.is_following
                              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                      {selectedUser.is_following
                          ? 'Following'
                          : selectedUser.follows_you
                              ? 'Follow Back'
                              : 'Follow'
                      }
                  </button>
                    )}
                </div>
              </div>

              {/* User Info */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedUser.name}</h2>
                <p className="text-gray-500">@{selectedUser.username}</p>
                <p className="mt-2 text-gray-700">{selectedUser.bio || "No bio available."}</p>
              </div>

              {/* Counters Section */}
              <div className="flex space-x-6 mt-6 border-t pt-4">
                
                {/* Following Count Clickable */}
                <div 
                    className="text-center cursor-pointer hover:opacity-75"
                    onClick={() => {
                        // User List modal kholne ka logic (optional)
                         // fetchUserList(selectedUser.id, 'following'); 
                    }}
                >
                  <span className="block font-bold text-lg text-gray-900">
                    {selectedUser.following || 0}
                  </span>
                  <span className="text-gray-500 text-sm">Following</span>
                </div>
                
                {/* Followers Count Clickable */}
                <div 
                    className="text-center cursor-pointer hover:opacity-75"
                    onClick={() => {
                         // fetchUserList(selectedUser.id, 'followers');
                    }}
                >
                  <span className="block font-bold text-lg text-gray-900">
                    {selectedUser.followers || 0}
                  </span>
                  <span className="text-gray-500 text-sm">Followers</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      {editProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 m-4">
            <form onSubmit={handleUpdateProfile}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Edit Profile</h3>
                <button
                  type="button"
                  onClick={() => setEditProfile(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                  <textarea
                    name="bio"
                    value={editFormData.bio}
                    onChange={handleEditFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isPosting}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
                >
                  {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- USER LIST MODAL (Followers/Following) --- */}
      {showUserListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden m-4 flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold capitalize">{modalType}</h3>
              <button onClick={() => setShowUserListModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto p-4 flex-1">
              {isLoadingList ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : modalUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No users found.</p>
              ) : (
                <div className="space-y-4">
                  {modalUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img src={user.avatar} alt="User" className="w-10 h-10 rounded-full" />
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.username}</p>
                        </div>
                      </div>
                      
                      {/* Follow/Unfollow Button (Khud ko follow nahi kar sakte) */}
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => {
                            followUser(user.id);
                            // List mein status turant update karne ke liye:
                            setModalUsers(prev => prev.map(u => 
                              u.id === user.id ? { ...u, is_following: !u.is_following } : u
                            ));
                          }}
                          className={`px-3 py-1 text-sm rounded-full font-semibold transition ${
                            user.is_following
                              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {user.is_following ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
       {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 p-3 flex flex-col items-center ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-500'}`}
        >
          <Home className="w-6 h-6" />
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 p-3 flex flex-col items-center ${activeTab === 'search' ? 'text-blue-600' : 'text-gray-500'}`}
        >
          <Search className="w-6 h-6" />
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 p-3 flex flex-col items-center relative ${activeTab === 'notifications' ? 'text-blue-600' : 'text-gray-500'}`}
        >
          <Bell className="w-6 h-6" />
          {unreadNotifications > 0 && (
            <span className="absolute top-2 right-6 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {unreadNotifications}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('messages');
            setSelectedChat(null); // 👈 YAHAN BHI YE LINE ADD KARO
          }}
          className={`flex-1 p-3 flex flex-col items-center relative ${activeTab === 'messages' ? 'text-blue-600' : 'text-gray-500'}`}
        >
          <Mail className="w-6 h-6" />
          {totalUnreadMessages > 0 && (
            <span className="absolute top-2 right-6 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {totalUnreadMessages}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 p-3 flex flex-col items-center ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-500'}`}
        >
          <User className="w-6 h-6" />
        </button>
      </nav>

    </div>
    </div>
  );
}

export default App;