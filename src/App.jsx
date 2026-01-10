import { useState, useEffect,useMemo } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import {
  Calendar, Clock, Search, Star, Video, Mic, MicOff, VideoOff, PhoneOff,
  MessageSquare, FileText, Download, User, Heart, Activity, Stethoscope,
  Filter, ChevronRight, Phone, Mail, Award, Users, ClipboardList
} from 'lucide-react';

const API_BASE_URL = "https://doctor-prescriptionn.onrender.com";

function App() {
  const tokenExists = !!localStorage.getItem('token');
  const [currentScreen, setCurrentScreen] = useState(tokenExists ? 'dashboard' : 'login');
  const [isLoggedIn, setIsLoggedIn] = useState(tokenExists);
  const [userType, setUserType] = useState(localStorage.getItem('role') || 'patient');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');

  // Real data states
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctorSchedule, setDoctorSchedule] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedRxPatient, setSelectedRxPatient] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [callPartner, setCallPartner] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reviewDoctorId, setReviewDoctorId] = useState(null);
  const [viewPrescriptionData, setViewPrescriptionData] = useState(null);

  // Call states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    // Ye check karega ki agar Token hai par Role gayab hai (Corrupted Data)
    // Toh ye khud hi Safai kar dega taaki White Screen na aaye.
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token && (!role || role === 'undefined' || role === 'null')) {
      console.log("🧹 Bad data found! Auto-cleaning...");
      localStorage.clear();
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      localStorage.setItem('currentScreen', currentScreen);
    }
  }, [currentScreen, isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
    }
  }, [isLoggedIn, userType]);


  const handleLogout = () => {
    localStorage.clear(); // Sab data saaf
    setIsLoggedIn(false);
    setCurrentScreen('login');
    setUserName('');
    setAppointments([]);
    setDoctorSchedule([]);
    setPrescriptions([]);
    setDoctors([]);
  };
  const fetchData = async () => {
    const token = localStorage.getItem('token');
    
    // Agar token nahi hai to login pe bhejo
    if (!token) {
      setIsLoggedIn(false);
      setCurrentScreen('login');
      return;
    }

    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      // 1. Doctors hamesha load honge
      const docsRes = await fetch(`${API_BASE_URL}/doctors`, { headers: authHeaders });
      if (docsRes.status === 401 || docsRes.status === 403) {
        handleLogout(); // Token kharab hai to Login pe bhejo
        return;
     }
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDoctors(docsData || []);
      }

      // 👇 MAIN FIX: Yahan 'user' add kiya hai, taaki Patient ka data load ho
      if (userType === 'patient' || userType === 'user') {
        
        // A. Appointments
        const aptRes = await fetch(`${API_BASE_URL}/appointments`, { headers: authHeaders });
        if (aptRes.ok) {
          const data = await aptRes.json();
          setAppointments(data || []);
        }

        // B. Prescriptions (URL Safety Check)
        // Pehle '/prescriptions' try karega, fail hua to '/prescription'
        let presRes = await fetch(`${API_BASE_URL}/prescriptions`, { headers: authHeaders });
        if (!presRes.ok) {
           presRes = await fetch(`${API_BASE_URL}/prescription`, { headers: authHeaders });
        }
        
        if (presRes.ok) {
          const presData = await presRes.json();
          setPrescriptions(presData || []);
        }
      } 
      // 3. Agar Doctor hai
      else if (userType === 'doctor') {
        const schRes = await fetch(`${API_BASE_URL}/appointments`, { headers: authHeaders });
        if (schRes.ok) {
          const data = await schRes.json();
          setDoctorSchedule(data || []);
        }
      }

    } catch (error) {
      console.error("Network Error:", error);
    }
  };

  const handlePrescriptionSuccess = (aptId) => {
    setDoctorSchedule(prevSchedule =>
      prevSchedule.map(apt =>
        apt.id === aptId ? { ...apt, prescriptionSent: true } : apt
      )
    );
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        alert(`Appointment ${newStatus} successfully!`);
        setDoctorSchedule(prevSchedule =>
          prevSchedule.map(apt =>
            apt.id === appointmentId ? { ...apt, status: newStatus } : apt
          )
        );
      } else {
        const err = await response.json();
        alert("Failed: " + err.detail);
      }
    } catch (error) {
      console.error(error);
      alert("Server Error");
    }
  };

  const handleBooking = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) return;
    const bookingData = {
      doctor_id: selectedDoctor.id,
      date: selectedDate,
      time: selectedTime
    };
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/book-appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingData)
      });
      if (response.ok) {
        alert('Appointment booked successfully!');
        fetchData();
        setCurrentScreen('dashboard');
      } else {
        const err = await response.json();
        alert('Failed: ' + (err.detail || 'Error'));
      }
    } catch (error) {
      console.error(error);
      alert('Error connecting to server.');
    }
  };

  const specialties = ['All', 'Cardiologist', 'Dentist', 'Dermatologist', 'Pediatrician', 'Neurologist', 'Orthopedic'];
  const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSearch = doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'All' || doctor.specialty === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  const upcomingAppointment = Array.isArray(appointments)
    ? appointments.find((apt) => apt.status === 'upcoming' || apt.status === 'confirmed')
    : null;

  // Screens as components

  const RateDoctorScreen = ({ doctorId, setCurrentScreen }) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const handleSubmit = async () => {
      const token = localStorage.getItem('token');
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            doctor_id: doctorId,
            rating: rating,
            comment: comment
          })
        });
        if (response.ok) {
          alert("Thanks for your review! ⭐");
          setCurrentScreen('dashboard');
        } else {
          const err = await response.json();
          alert("Error: " + err.detail);
        }
      } catch (error) {
        console.error(error);
        alert("Server Error");
      } finally {
        setLoading(false);
      }
    };
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 text-center relative">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
            title="Close"
          >
            ✕
          </button>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Rate Your Experience</h2>
          <p className="text-gray-500 mb-6">How was your checkup?</p>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-4xl transition-transform hover:scale-110 ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="font-bold text-lg text-teal-600 mb-4">{rating} Stars</p>
          <textarea
            placeholder="Write a review (optional)..."
            className="w-full p-3 border rounded-xl mb-6 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows="3"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentScreen('dashboard')}
              className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-200"
            >
              {loading ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const MedicalRecordsScreen = ({ setCurrentScreen }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      fetchReports();
    }, []);
    const fetchReports = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(`${API_BASE_URL}/my-reports`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setReports(data);
        } else {
          alert("Failed to fetch reports");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm px-6 py-4 flex items-center gap-4">
          <button onClick={() => setCurrentScreen('dashboard')} className="text-gray-500 hover:text-teal-600 font-bold text-lg">← Back</button>
          <h1 className="text-xl font-bold text-gray-800">My Medical Records</h1>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          {loading ? (
            <p className="text-center text-gray-500 mt-10">Loading records...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{report.title}</h3>
                      <p className="text-sm text-gray-500">Uploaded by {report.doctor_name} • {report.date}</p>
                    </div>
                  </div>
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-teal-50 text-teal-700 px-4 py-2 rounded-lg font-medium hover:bg-teal-100 flex items-center gap-2"
                  >
                    <Download size={18} /> View / Download
                  </a>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-center py-10">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="text-gray-400" size={30} />
                  </div>
                  <p className="text-gray-500">No medical records found.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  };

  const LoginScreen = ({ setUserType, setCurrentScreen, setIsLoggedIn, setUserName }) => {
    // Default 'patient' select rahega
    const [selectedTab, setSelectedTab] = useState('patient'); 
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
  
    const handleLogin = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
  
        if (response.ok) {
          const data = await response.json();
          
          // 👇 Backend se jo role aaya, usse frontend ke format mein convert kiya
          // Backend 'user' bhejta hai, hum 'patient' use karte hain
          const actualRole = data.role === 'user' ? 'patient' : 'doctor';
  
          // 👇 MAIN CHECK: Jo Tab select kiya hai, kya wo actual role se match karta hai?
          if (selectedTab !== actualRole) {
              alert(`⚠️ Access Denied!\n\nYou are registered as a ${actualRole.toUpperCase()}.\nPlease select the "${actualRole === 'patient' ? 'Patient' : 'Doctor'}" tab to login.`);
              setLoading(false);
              return; // 🛑 Yahi ruk jao, dashboard mat dikhao
          }
  
          // Agar match ho gaya, to aage badho
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('role', data.role);
          localStorage.setItem('userName', data.name);
          localStorage.setItem('currentScreen', 'dashboard');
          
          setUserType(actualRole); 
          setUserName(data.name || (data.role === 'doctor' ? 'Dr. User' : 'User'));
          
          setIsLoggedIn(true);
          setCurrentScreen('dashboard');
  
        } else { 
          alert("Invalid Credentials"); 
        }
      } catch (error) { 
        console.error(error); 
        alert("Server Error"); 
      } finally { 
        setLoading(false); 
      }
    };
  
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">HealthConnect</h1>
          <p className="text-center text-gray-600 mb-8">Login to your account</p>
          
          <div className="bg-white rounded-2xl shadow-xl p-2">
              {/* 👇 Tab Selection Logic Update Kiya */}
              <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
                <button 
                  onClick={() => setSelectedTab('patient')} 
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${selectedTab === 'patient' ? 'bg-white text-teal-600 shadow-md' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Patient
                </button>
                <button 
                  onClick={() => setSelectedTab('doctor')} 
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${selectedTab === 'doctor' ? 'bg-white text-teal-600 shadow-md' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  Doctor
                </button>
              </div>
  
              <div className="space-y-4">
                  <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div className="relative">
                      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <button onClick={handleLogin} disabled={loading} className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:shadow-xl disabled:opacity-50">
                      {loading ? "Signing In..." : "Sign In"}
                  </button>
              </div>
              
              <p className="mt-6 text-center text-gray-600">Don't have an account? <button onClick={() => setCurrentScreen('signup')} className="text-teal-600 font-semibold">Sign Up</button></p>
          </div>
        </div>
      </div>
    );
  };
  const SignupScreen = ({ setCurrentScreen, setUserType, setIsLoggedIn, setUserName }) => {
    const [formData, setFormData] = useState({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role: 'user'
    });
    const [isDoctor, setIsDoctor] = useState(false);
    const [loading, setLoading] = useState(false);
  
    const handleSignup = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
  
        if (response.ok) {
          const data = await response.json();
          
          // 1. Token Save
          localStorage.setItem('token', data.access_token);
          
          // 2. 👇 NAME SAVE KARO (Ye missing tha)
          // Backend se naam nahi aaya to Form wala naam use karenge
          const nameToSave = data.name || formData.full_name || 'User';
          localStorage.setItem('userName', nameToSave);
          if (setUserName) setUserName(nameToSave); // State update
  
          // 3. Login State Set
          setIsLoggedIn(true);
  
          if (isDoctor) {
            setCurrentScreen('create-profile');
          } else {
            setUserType('patient');
            setCurrentScreen('dashboard');
          }
        } else {
          const errorData = await response.json();
          alert(`Signup Failed: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(error);
        alert("Backend Error");
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Create Account</h1>
          <div className="space-y-4 mt-8">
            <input type="text" placeholder="Full Name" className="w-full p-3 border rounded-xl" onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
            <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl" onChange={(e) => setFormData({...formData, email: e.target.value})} />
            <input type="text" placeholder="Phone" className="w-full p-3 border rounded-xl" onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            <input type="password" placeholder="Password" className="w-full p-3 border rounded-xl" onChange={(e) => setFormData({...formData, password: e.target.value})} />
            
            <div className="flex items-center gap-2 py-2">
              <input type="checkbox" id="docCheck" checked={isDoctor} onChange={(e) => {
                  setIsDoctor(e.target.checked);
                  setFormData({...formData, role: e.target.checked ? 'doctor' : 'user'});
              }} className="w-5 h-5 accent-teal-600" />
              <label htmlFor="docCheck" className="text-gray-700 font-medium">I am a Doctor 👨‍⚕️</label>
            </div>
  
            <button onClick={handleSignup} disabled={loading} className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-3 rounded-xl font-bold">
              {loading ? "Creating..." : "Sign Up"}
            </button>
          </div>
          <p className="mt-4 text-center">Already user? <button onClick={() => setCurrentScreen('login')} className="text-teal-600 font-bold">Login</button></p>
        </div>
      </div>
    );
  };

  const DoctorProfileForm = ({ setCurrentScreen, setUserType }) => {
    const [formData, setFormData] = useState({
      specialty: 'Cardiologist',
      experience: 0,
      consultation_fee: 500,
      bio: ''
    });
    const specialties = ['Cardiologist', 'Dentist', 'Dermatologist', 'Pediatrician', 'Neurologist', 'Orthopedic'];
    const handleSubmit = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(`${API_BASE_URL}/doctor-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        if (response.ok) {
          alert("Profile Created Successfully!");
          setUserType('doctor');
          setCurrentScreen('dashboard');
        } else {
          alert("Failed. Check backend logs.");
        }
      } catch (error) {
        console.error(error);
        alert("Server Error");
      }
    };
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Complete Profile</h2>
          <div className="space-y-4">
            <select className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, specialty: e.target.value})}>
              {specialties.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" placeholder="Experience (Years)" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, experience: parseInt(e.target.value)})} />
            <input type="number" placeholder="Fee (₹)" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, consultation_fee: parseInt(e.target.value)})} />
            <textarea placeholder="Bio" className="w-full p-3 border rounded-xl" rows="3" onChange={e => setFormData({...formData, bio: e.target.value})} />
            <button onClick={handleSubmit} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold">Save & Go to Dashboard</button>
          </div>
        </div>
      </div>
    );
  };

  const DoctorDashboard = ({ handleLogout, setCurrentScreen, doctorSchedule, handleStatusUpdate, setCallPartner, setSelectedRxPatient, userName }) => {
    const [stats, setStats] = useState({
      total_patients: 0,
      todays_appointments: 0,
      rating: 0
    });
  
    // 👇 LOGIC: Unique Patient Pending Calculation
    // "Ek user chahe kitni bar bhi appointment le, agar ek bar report bhej di to pending na dikhaye"
    const pendingReportsCount = useMemo(() => {
      if (!doctorSchedule) return 0;
  
      const patientStatus = {};
  
      doctorSchedule.forEach(apt => {
          // Agar ye patient pehli baar dikha hai, to uska object banao
          if (!patientStatus[apt.patient_id]) {
              patientStatus[apt.patient_id] = { hasCompleted: false, hasReportSent: false };
          }
  
          // Check karo kya is patient ka koi bhi appointment complete hua hai?
          if (apt.status === 'completed') {
              patientStatus[apt.patient_id].hasCompleted = true;
          }
  
          // Check karo kya is patient ko AAJ ya PEHLE kabhi bhi report/prescription bheji hai?
          if (apt.prescriptionSent) {
              patientStatus[apt.patient_id].hasReportSent = true;
          }
      });
  
      // Ab count karo aise patients jinka appointment complete hai lekin EK BAAR BHI report nahi gayi
      let count = 0;
      Object.values(patientStatus).forEach(p => {
          if (p.hasCompleted && !p.hasReportSent) {
              count++;
          }
      });
  
      return count;
    }, [doctorSchedule]);
    // 👆 LOGIC END
  
    const isFutureAppointment = (dateStr, timeStr) => {
      return new Date(`${dateStr} ${timeStr}`) > new Date();
    };
  
    const getNextAppointment = () => {
      if (!doctorSchedule || doctorSchedule.length === 0) return null;
      const upcoming = doctorSchedule.filter(apt => apt.status === 'confirmed' && isFutureAppointment(apt.date, apt.time));
      return upcoming[0] || null;
    };
  
    const nextApt = getNextAppointment();
  
    useEffect(() => {
      const fetchStats = async () => {
        const token = localStorage.getItem('token');
        try {
          const response = await fetch(`${API_BASE_URL}/doctor/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setStats(data);
          }
        } catch (error) {
          console.error("Error fetching stats:", error);
        }
      };
      fetchStats();
    }, []);
  
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white">
              <Stethoscope size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-800">HealthConnect <span className="text-teal-600 text-sm font-normal bg-teal-50 px-2 py-1 rounded-full ml-2">Doctor Panel</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="text-sm text-red-500 font-medium hover:bg-red-50 px-3 py-1 rounded-lg">Logout</button>
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-gray-800">{userName}</p>
              <p className="text-xs text-gray-500">Cardiologist</p>
            </div>
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
              <User size={20} />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Users size={24} /></div>
              <div><p className="text-gray-500 text-sm">Total Patients</p><h3 className="text-2xl font-bold text-gray-800">{stats.total_patients}</h3></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><Calendar size={24} /></div>
              <div><p className="text-gray-500 text-sm">Today's Appointment</p><h3 className="text-2xl font-bold text-gray-800">{stats.todays_appointments}</h3></div>
            </div>
            
            {/* 👇 UPDATED: Yahan ab humara calculated 'pendingReportsCount' dikhega */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center"><Clock size={24} /></div>
              <div><p className="text-gray-500 text-sm">Pending Reports</p><h3 className="text-2xl font-bold text-gray-800">{pendingReportsCount}</h3></div>
            </div>
  
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center"><Star size={24} /></div>
              <div><p className="text-gray-500 text-sm">Rating</p><h3 className="text-2xl font-bold text-gray-800">{stats.rating} ⭐</h3></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Today's Schedule</h2>
                <button className="text-teal-600 text-sm font-semibold hover:underline">View Calendar</button>
              </div>
              <div className="space-y-4">
                {doctorSchedule.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-200 text-gray-500 font-bold text-lg">
                        {patient.patientName ? patient.patientName.charAt(0) : "U"}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{patient.patientName}</h4>
                        <p className="text-sm text-gray-500">{patient.issue || "General Checkup"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right mr-2">
                        <p className="font-bold text-gray-800">{patient.time}</p>
                        <p className="text-xs text-gray-400">{patient.date}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          patient.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                          (patient.status === 'cancelled' ? 'bg-red-100 text-red-600' : 
                          (patient.status === 'completed' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-700'))
                        }`}>
                          {patient.status}
                        </span>
                      </div>
                      {patient.status === 'upcoming' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleStatusUpdate(patient.id, 'confirmed')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Accept">✅</button>
                          <button onClick={() => handleStatusUpdate(patient.id, 'cancelled')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Reject">❌</button>
                        </div>
                      )}
                      {patient.status === 'confirmed' && (
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setCallPartner({ name: patient.patientName, role: 'Patient' });
                            setCurrentScreen('consultation');
                          }} className="p-2 bg-teal-100 text-teal-600 rounded-lg hover:bg-teal-200" title="Video Call">
                            <Video size={20} />
                          </button>
                          <button 
                            onClick={() => handleStatusUpdate(patient.id, 'completed')}
                            disabled={isFutureAppointment(patient.date, patient.time)}
                            className={`p-2 rounded-lg flex items-center gap-1 ${
                              isFutureAppointment(patient.date, patient.time) 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            }`} 
                            title="Complete"
                          >
                            🏁
                          </button>
                        </div>
                      )}
                      {patient.status === 'completed' && (
                        patient.prescriptionSent ? (
                          <button disabled className="p-2 bg-green-50 text-green-600 rounded-lg flex items-center gap-1 text-sm font-bold cursor-default">✅ Sent</button>
                        ) : 
                          <button 
                            onClick={() => {
                              setSelectedRxPatient(patient);
                              setCurrentScreen('write-prescription');
                            }}
                            className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 flex items-center gap-1 text-sm font-bold" 
                            title="Write Prescription"
                          >
                            💊 Write Rx
                          </button>
                      )}
                    </div>
                  </div>
                ))}
                {doctorSchedule.length === 0 && <p className="text-gray-500 text-center py-4">No appointments today.</p>}
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-xl font-bold mb-2">Next Appointment</h3>
                {nextApt ? (
                  <>
                    <div className="mt-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                      <div className="flex items-center gap-3 mb-3">
                        <Clock className="w-5 h-5 opacity-80" />
                        <span className="font-medium">{nextApt.time} - {nextApt.date === new Date().toISOString().split('T')[0] ? "Today" : nextApt.date}</span>
                      </div>
                      <h4 className="text-2xl font-bold truncate">{nextApt.patientName}</h4>
                      <p className="opacity-80 text-sm mt-1">{nextApt.issue || "General Checkup"}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCallPartner({ name: nextApt.patientName, role: 'Patient' });
                        setCurrentScreen('consultation');
                      }} 
                      className="w-full mt-4 bg-white text-teal-600 py-3 rounded-xl font-bold shadow-md hover:bg-gray-50 transition-colors"
                    >
                      Join Video Room
                    </button>
                  </>
                ) : (
                  <div className="mt-4 p-6 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 text-center">
                    <p className="opacity-90">No upcoming confirmed appointments.</p>
                    <p className="text-sm mt-2 opacity-70">Relax for a while! ☕</p>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 gap-4">
                  <button onClick={() => setCurrentScreen('upload-report')} className="p-4 rounded-xl bg-purple-50 text-purple-700 flex flex-col items-center gap-2 hover:bg-purple-100 transition-colors">
                    <FileText size={24} /> <span className="text-sm font-medium">Reports</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  };
  const PrescriptionViewScreen = ({ prescription, setCurrentScreen }) => {
    if (!prescription) return null;
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-teal-700 p-6 text-white flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6" /> HealthConnect
              </h1>
              <p className="text-teal-100 text-sm mt-1">Digital Medical Record</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">Dr. {prescription.doctor_name}</p>
              <p className="text-teal-200 text-sm">Specialist</p>
            </div>
          </div>
          <div className="p-8">
            <div className="mb-6 pb-4 border-b border-gray-100">
              <p className="text-gray-500 text-sm">Patient Name</p>
              <h2 className="text-xl font-bold text-gray-800">{prescription.patientName || "Patient"}</h2> 
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-4 mb-6">
              <div>
                <p className="text-gray-500 text-sm">Date</p>
                <p className="font-bold text-gray-800">{prescription.date}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-sm">Prescription ID</p>
                <p className="font-bold text-gray-800">#{prescription.id}</p>
              </div>
            </div>
            <div className="mb-8">
              <h3 className="text-teal-700 font-bold text-lg mb-3 flex items-center gap-2">
                💊 Medications (Rx)
              </h3>
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                <p className="text-gray-800 whitespace-pre-line leading-relaxed text-lg font-medium">
                  {prescription.medicines}
                </p>
              </div>
            </div>
            {prescription.notes && (
              <div className="mb-8">
                <h3 className="text-teal-700 font-bold text-lg mb-2 flex items-center gap-2">
                  📝 Doctor's Advice
                </h3>
                <p className="text-gray-600 italic bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                  "{prescription.notes}"
                </p>
              </div>
            )}
            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-end">
              <div className="text-center">
                <p className="font-dancing-script text-2xl text-teal-800">Dr. {prescription.doctor_name}</p>
                <p className="text-xs text-gray-400 mt-1">Authorized Signature</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-between items-center">
            <button 
              onClick={() => setCurrentScreen('prescriptions')}
              className="text-gray-600 font-medium hover:text-gray-900"
            >
              Close
            </button>
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 shadow-md transition-all"
            >
              🖨️ Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PatientDashboard = ({ handleLogout, setCurrentScreen, setReviewDoctorId, appointments, upcomingAppointment, userName, setCallPartner }) => {
    // 👇 STATE FOR VITALS (Ab ye Backend se aayega)
    const [vitals, setVitals] = useState({ heart_rate: '--', bp: '--/--', appointments: 0 });
  
    // 👇 FETCH VITALS ON LOAD
    useEffect(() => {
      const fetchVitals = async () => {
        const token = localStorage.getItem('token');
        try {
          const response = await fetch(`${API_BASE_URL}/patient/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setVitals(data);
          }
        } catch (error) { console.error(error); }
      };
      fetchVitals();
    }, [appointments]); // Jab appointments change hon tab bhi refresh ho
  
    // 👇 UPDATE FUNCTION (Simple Prompt use kiya hai edit ke liye)
    const handleEditVitals = async () => {
      const newBp = prompt("Enter new Blood Pressure (e.g. 120/80):", vitals.bp);
      const newHr = prompt("Enter new Heart Rate (e.g. 72):", vitals.heart_rate);
  
      if (newBp && newHr) {
        const token = localStorage.getItem('token');
        try {
          const response = await fetch(`${API_BASE_URL}/patient/stats`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ heart_rate: newHr, bp: newBp })
          });
          if (response.ok) {
            setVitals({ ...vitals, heart_rate: newHr, bp: newBp }); // UI turant update karo
          }
        } catch (error) { alert("Failed to update"); }
      }
    };
  
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-md"><Activity className="w-6 h-6 text-white" /></div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">HealthConnect</h1>
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <button onClick={() => setCurrentScreen('dashboard')} className="text-teal-600 font-medium hover:text-teal-700 transition-colors">Dashboard</button>
                <button onClick={() => setCurrentScreen('doctors')} className="text-gray-600 font-medium hover:text-teal-600 transition-colors">Find Doctors</button>
                <button onClick={() => setCurrentScreen('prescriptions')} className="text-gray-600 font-medium hover:text-teal-600 transition-colors">Prescriptions</button>
              </nav>
              <div className="flex items-center gap-4">
                <button onClick={handleLogout} className="text-sm text-red-500 font-medium hover:bg-red-50 px-3 py-1 rounded-lg">Logout</button>
                <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-teal-600" /></div>
                <div className="hidden sm:block"><p className="text-sm font-semibold text-gray-800">{userName}</p><p className="text-xs text-gray-500">Patient</p></div>
              </div>
            </div>
          </div>
        </header>
  
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome back, {userName}!</h2>
            <p className="text-gray-600">Here's your health dashboard</p>
          </div>
  
          {upcomingAppointment ? (
            <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-6 mb-8 text-white shadow-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2"><Calendar className="w-5 h-5" /><span className="text-sm font-medium opacity-90">Upcoming Appointment</span></div>
                  <h3 className="text-2xl font-bold mb-1">{upcomingAppointment.doctorName}</h3>
                  <p className="opacity-90 mb-4">{upcomingAppointment.specialty}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1"><Calendar className="w-4 h-4" /><span>{upcomingAppointment.date}</span></div>
                    <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>{upcomingAppointment.time}</span></div>
                  </div>
                </div>
                <button onClick={() => { setCallPartner({ name: upcomingAppointment.doctorName, role: 'Doctor' }); setCurrentScreen('consultation'); }} className="bg-white text-teal-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg">Join Now</button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-8 text-center text-gray-500">No upcoming appointments. Find a doctor to book one.</div>
          )}
  
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <button onClick={() => setCurrentScreen('doctors')} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all transform hover:scale-[1.02] text-left group">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors"><Search className="w-6 h-6 text-teal-600" /></div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Find a Doctor</h3>
              <p className="text-sm text-gray-600 mb-3">Browse and book appointments with specialists</p>
              <div className="flex items-center text-teal-600 font-medium text-sm"><span>Explore Doctors</span><ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></div>
            </button>
            <button onClick={() => setCurrentScreen('prescriptions')} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all transform hover:scale-[1.02] text-left group">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors"><FileText className="w-6 h-6 text-blue-600" /></div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">My Prescriptions</h3>
              <p className="text-sm text-gray-600 mb-3">View and download your prescriptions</p>
              <div className="flex items-center text-blue-600 font-medium text-sm"><span>View All</span><ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></div>
            </button>
            <button onClick={() => setCurrentScreen('medical-records')} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all transform hover:scale-[1.02] text-left group">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-200 transition-colors"><Heart className="w-6 h-6 text-cyan-600" /></div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Medical Records</h3>
              <p className="text-sm text-gray-600 mb-3">Access your complete medical history</p>
              <div className="flex items-center text-cyan-600 font-medium text-sm"><span>View Records</span><ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></div>
            </button>
          </div>
  
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Appointments</h3>
              <div className="space-y-3">
                {appointments?.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center"><Stethoscope className="w-5 h-5 text-teal-600" /></div>
                      <div><p className="font-semibold text-gray-800">{apt.doctorName}</p><p className="text-sm text-gray-600">{apt.specialty}</p></div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">{apt.date}</p>
                      {apt.status === 'completed' ? (
                        <button onClick={() => { setReviewDoctorId(apt.doctor_id); setCurrentScreen('rate-doctor'); }} className="mt-1 inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-yellow-200 transition-colors shadow-sm">⭐ Rate</button>
                      ) : (
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${apt.status === 'confirmed' ? 'bg-green-100 text-green-700' : (apt.status === 'cancelled' ? 'bg-red-100 text-red-600' : (apt.status === 'upcoming' ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-700'))}`}>{apt.status}</span>
                      )}
                    </div>
                  </div>
                ))}
                {(!appointments || appointments.length === 0) && <p className="text-gray-500 text-center py-4">No past appointments.</p>}
              </div>
            </div>
  
            <div className="bg-white rounded-2xl p-6 shadow-md relative">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Health Stats</h3>
                  {/* 👇 EDIT BUTTON */}
                  <button onClick={handleEditVitals} className="text-teal-600 text-sm font-bold hover:bg-teal-50 px-3 py-1 rounded-lg transition-colors">✎ Edit</button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-700">Heart Rate</span><Activity className="w-5 h-5 text-red-500" /></div>
                  <p className="text-2xl font-bold text-gray-800">{vitals.heart_rate} <span className="text-sm font-normal text-gray-600">bpm</span></p>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-700">Blood Pressure</span><Heart className="w-5 h-5 text-blue-500" /></div>
                  <p className="text-2xl font-bold text-gray-800">{vitals.bp} <span className="text-sm font-normal text-gray-600">mmHg</span></p>
                </div>
                <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-gray-700">Appointments</span><Calendar className="w-5 h-5 text-green-500" /></div>
                  <p className="text-2xl font-bold text-gray-800">{vitals.appointments} <span className="text-sm font-normal text-gray-600">total</span></p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  };

  const DoctorsScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-md"><Activity className="w-6 h-6 text-white" /></div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">HealthConnect</h1>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setCurrentScreen('dashboard')} className="text-gray-600 font-medium hover:text-teal-600 transition-colors">Dashboard</button>
              <button onClick={() => setCurrentScreen('doctors')} className="text-teal-600 font-medium hover:text-teal-700 transition-colors">Find Doctors</button>
              <button onClick={() => setCurrentScreen('prescriptions')} className="text-gray-600 font-medium hover:text-teal-600 transition-colors">Prescriptions</button>
            </nav>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-teal-600" /></div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button onClick={() => setCurrentScreen('dashboard')} className="text-gray-600 mb-4 hover:text-teal-600">← Back to Dashboard</button>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Find Your Doctor</h2>
          <p className="text-gray-600">Book appointments with top specialists</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Search doctors by name or specialty..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer">
                {specialties.map((specialty) => (<option key={specialty} value={specialty}>{specialty}</option>))}
              </select>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doctor) => (
            <div key={doctor.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden group">
              <div className="h-48 overflow-hidden bg-gradient-to-br from-teal-100 to-cyan-100"><img src={doctor.image || "/doctor-placeholder.png"} alt={doctor.name} className="w-full h-full object-cover" /></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="text-xl font-bold text-gray-800 mb-1">{doctor.name}</h3><p className="text-teal-600 font-medium">{doctor.specialty}</p></div>
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg"><Star className="w-4 h-4 text-yellow-500 fill-current" /><span className="text-sm font-semibold text-gray-800">{doctor.rating}</span></div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600"><Award className="w-4 h-4 text-teal-500" /><span>{doctor.experience} years experience</span></div>
                  <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="w-4 h-4 text-teal-500" /><span>{doctor.consultations.toLocaleString()} consultations</span></div>
                  <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="w-4 h-4 text-teal-500" /><span>Next available: {doctor.nextAvailable}</span></div>
                </div>
                <button onClick={() => { setSelectedDoctor(doctor); setCurrentScreen('booking'); }} className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:from-teal-600 hover:to-cyan-700 transform hover:scale-[1.02] transition-all shadow-md">Book Appointment</button>
              </div>
            </div>
          ))}
          {filteredDoctors.length === 0 && <p className="col-span-3 text-center text-gray-500">No doctors found matching your search.</p>}
        </div>
      </main>
    </div>
  );

  const BookingScreen = () => {
    // 👇 Helper Function: Check karo time nikal gaya ya nahi
    const isTimeSlotPast = (timeStr) => {
        if (!selectedDate) return true; // Date select nahi hai to disable rakho

        const today = new Date();
        const selected = new Date(selectedDate);

        // 1. Agar date Future ki hai (e.g. Kal ya Parso), to saare slots open hain
        if (selected.setHours(0,0,0,0) > today.setHours(0,0,0,0)) {
            return false;
        }

        // 2. Agar date Past ki hai (waise min date laga hai, par safety ke liye)
        if (selected.setHours(0,0,0,0) < today.setHours(0,0,0,0)) {
            return true;
        }

        // 3. Agar Date "AAJ" (Today) ki hai, to Time compare karo
        // Time format "9:00 AM" ko convert karna padega
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        
        hours = parseInt(hours);
        minutes = parseInt(minutes);

        if (hours === 12 && modifier === 'AM') {
            hours = 0;
        }
        if (hours !== 12 && modifier === 'PM') {
            hours += 12;
        }

        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        const currentTime = new Date();

        // Agar Slot ka time abhi ke time se peeche hai, to TRUE (Disabled)
        return slotTime < currentTime;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentScreen('doctors')} className="text-gray-600 hover:text-teal-600 transition-colors">← Back</button>
                <h1 className="text-2xl font-bold text-gray-800">Book Appointment</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {selectedDoctor && (
            <>
              <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-teal-100 to-cyan-100"><img src={selectedDoctor.image} alt={selectedDoctor.name} className="w-full h-full object-cover" /></div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedDoctor.name}</h2>
                    <p className="text-teal-600 font-medium mb-3">{selectedDoctor.specialty}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500 fill-current" /><span className="font-medium">{selectedDoctor.rating}</span></div>
                      <div className="flex items-center gap-1"><Award className="w-4 h-4 text-teal-500" /><span>{selectedDoctor.experience} years exp</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Select Date</h3>
                <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTime(''); // Date change hone par Time reset karo
                    }} 
                    min={new Date().toISOString().split('T')[0]} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" 
                />
              </div>
              
              {/* 👇 Time Slot Selection (Disable Logic Added) */}
              <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Select Time Slot</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {timeSlots.map((time) => {
                      const isDisabled = isTimeSlotPast(time);
                      return (
                        <button 
                            key={time} 
                            onClick={() => !isDisabled && setSelectedTime(time)} 
                            disabled={isDisabled}
                            className={`py-3 px-4 rounded-xl font-medium transition-all ${
                                isDisabled 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' // Disabled Style
                                : selectedTime === time 
                                    ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md' 
                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            {time}
                        </button>
                      );
                  })}
                </div>
                {!selectedDate && <p className="text-xs text-red-400 mt-2">* Please select a date first</p>}
              </div>

              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-6 mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Appointment Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">Doctor:</span><span className="font-semibold text-gray-800">{selectedDoctor.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Specialty:</span><span className="font-semibold text-gray-800">{selectedDoctor.specialty}</span></div>
                  {selectedDate && (<div className="flex justify-between"><span className="text-gray-600">Date:</span><span className="font-semibold text-gray-800">{selectedDate}</span></div>)}
                  {selectedTime && (<div className="flex justify-between"><span className="text-gray-600">Time:</span><span className="font-semibold text-gray-800">{selectedTime}</span></div>)}
                  <div className="flex justify-between pt-3 border-t border-gray-200 mt-3"><span className="text-gray-600">Consultation Fee:</span><span className="font-bold text-teal-600 text-lg">$50</span></div>
                </div>
              </div>
              <button onClick={handleBooking} disabled={!selectedDate || !selectedTime} className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-4 rounded-xl font-semibold hover:from-teal-600 hover:to-cyan-700 transform hover:scale-[1.02] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">Confirm Booking</button>
            </>
          )}
        </main>
      </div>
    );
  };

// 👇 Naya ZegoCloud wala Code
const ConsultationScreen = ({ userName, callPartner, setCurrentScreen }) => {
  
  // ⚠️ YAHA APNI REAL KEYS DAALNA MAT BHOOLNA
  const appID = 321715427; // Apne ZegoCloud Console se number copy karo
  const serverSecret = "64faaa1646d049dc0effefdbaa41d6e1"; // Apne Console se string copy karo

  // Room ID abhi ke liye fixed hai taaki tum aur patient same room mein aao
  const roomID = "HealthConnect_Video_Room"; 

  const myMeeting = async (element) => {
    // Token Generate
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID, 
      serverSecret, 
      roomID, 
      Date.now().toString(), // Random UserID
      userName || "Guest"    // User ka naam
    );

    // Instance Create
    const zp = ZegoUIKitPrebuilt.create(kitToken);

    // Join Room
    zp.joinRoom({
      container: element,
      scenario: {
        mode: ZegoUIKitPrebuilt.OneONoneCall, // Video Call Mode
      },
      showScreenSharingButton: false,
      onLeaveRoom: () => {
        // Call katne par dashboard par wapis
        setCurrentScreen('dashboard');
      },
    });
  };

  return (
    <div
      className="myCallContainer"
      ref={myMeeting}
      style={{ width: '100vw', height: '100vh' }}
    ></div>
  );
};
  // 👇 prop mein 'onSuccess' add kiya
const UploadReportScreen = ({ setCurrentScreen, doctorSchedule, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [selectedApt, setSelectedApt] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  // Unique Patients Logic
  const uniquePatients = [];
  const seenIds = new Set();
  if (doctorSchedule) {
    doctorSchedule.forEach(apt => {
      if (!seenIds.has(apt.patient_id)) {
        seenIds.add(apt.patient_id);
        uniquePatients.push(apt);
      }
    });
  }

  const handleUpload = async () => {
    if(!title || !selectedApt || !file) { return alert("Please fill all fields and select a file"); }
    
    const [aptId, patId] = selectedApt.split(","); 
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('patient_id', patId);
    formData.append('file', file);
    
    const token = localStorage.getItem('token');
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/reports`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        
        if (response.ok) { 
            alert("Report Uploaded Successfully! 📂");
            
            // 👇 MAIN FIX: App ko batao ki kaam ho gaya (Count kam hoga)
            // Hum 'aptId' ko number mein convert karke bhej rahe hain
            if (onSuccess) {
                onSuccess(parseInt(aptId));
            }

            setCurrentScreen('dashboard'); 
        } 
        else { const err = await response.json(); alert("Failed: " + err.detail); }
    } catch (error) { console.error(error); alert("Server Error"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
        <div className="flex justify-between mb-6"><h2 className="text-2xl font-bold text-gray-800">Upload Medical Report</h2><button onClick={() => setCurrentScreen('dashboard')} className="text-gray-500 hover:text-red-500">✕ Close</button></div>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient</label>
                <select className="w-full p-3 border rounded-xl bg-white" onChange={(e) => setSelectedApt(e.target.value)}>
                    <option value="">-- Choose Patient --</option>
                    {uniquePatients.map(apt => (
                        <option key={apt.id} value={`${apt.id},${apt.patient_id}`}>{apt.patientName}</option>
                    ))}
                </select>
            </div>
            <input type="text" placeholder="Report Title" className="w-full p-3 border rounded-xl" value={title} onChange={e => setTitle(e.target.value)} />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center"><input type="file" onChange={handleFileChange} className="hidden" id="file-upload" /><label htmlFor="file-upload" className="cursor-pointer"><div className="text-teal-600 font-bold mb-1">{file ? file.name : "Click to Upload File"}</div><p className="text-xs text-gray-500">PDF, JPG, PNG supported</p></label></div>
            <button onClick={handleUpload} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors">{loading ? "Uploading..." : "Upload Report"}</button>
        </div>
      </div>
    </div>
  );
};
  const WritePrescriptionScreen = ({ setCurrentScreen, selectedRxPatient, onSuccess }) => {
    const [medicines, setMedicines] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
  
    const handleSubmit = async () => {
      if (!selectedRxPatient || !medicines) {
        alert("Please enter medicines");
        return;
      }
      const token = localStorage.getItem("token");
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/prescriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            appointment_id: selectedRxPatient.id,
            patient_id: selectedRxPatient.patient_id,
            medicines,
            notes
          })
        });
        if (response.ok) {
          alert("Prescription sent successfully 💊");
          onSuccess(selectedRxPatient.id);
          setCurrentScreen("dashboard");
        } else {
          alert("Failed to send prescription");
        }
      } catch (err) {
        console.error(err);
        alert("Server Error");
      } finally {
        setLoading(false);
      }
    };
  
    if (!selectedRxPatient) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <button onClick={() => setCurrentScreen("dashboard")} className="text-teal-600 font-bold">
            ← Go Back to Dashboard
          </button>
        </div>
      );
    }
  
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8 relative">
          
          {/* 👇 1. TOP RIGHT CLOSE BUTTON */}
          <button 
              onClick={() => setCurrentScreen('dashboard')} 
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl transition-colors"
              title="Close"
          >
              ✕
          </button>
  
          <h2 className="text-2xl font-bold mb-2">Write Prescription</h2>
          <p className="text-gray-500 mb-6">Patient: <span className="font-semibold text-teal-600">{selectedRxPatient.patientName}</span></p>
  
          <textarea
            className="w-full p-3 border rounded-xl mb-4 bg-gray-50 focus:bg-white transition-colors"
            rows={4}
            placeholder="💊 Medicines (e.g. Paracetamol 500mg - 2 times a day)"
            value={medicines}
            onChange={(e) => setMedicines(e.target.value)}
          />
  
          <textarea
            className="w-full p-3 border rounded-xl mb-6 bg-gray-50 focus:bg-white transition-colors"
            rows={2}
            placeholder="📝 Notes / Advice (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
  
          {/* 👇 2. BOTTOM BUTTONS (CANCEL & SEND) */}
          <div className="flex gap-3">
              <button
                onClick={() => setCurrentScreen('dashboard')}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 shadow-md transition-colors"
              >
                {loading ? "Sending..." : "Send Prescription"}
              </button>
          </div>
  
        </div>
      </div>
    );
  };

  const PrescriptionsScreen = ({ prescriptions, setCurrentScreen, setViewPrescriptionData }) => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-md">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">HealthConnect</h1>
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <button onClick={() => setCurrentScreen('dashboard')} className="text-gray-600 font-medium hover:text-teal-600 transition-colors">Dashboard</button>
                <button onClick={() => setCurrentScreen('doctors')} className="text-gray-600 font-medium hover:text-teal-600 transition-colors">Find Doctors</button>
                <button onClick={() => setCurrentScreen('prescriptions')} className="text-teal-600 font-medium hover:text-teal-700 transition-colors">Prescriptions</button>
              </nav>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-teal-600" />
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <button onClick={() => setCurrentScreen('dashboard')} className="text-gray-600 mb-4 hover:text-teal-600">← Back to Dashboard</button>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">My Prescriptions</h2>
            <p className="text-gray-600">View and download your digital prescriptions</p>
          </div>
          <div className="space-y-6">
            {(!prescriptions || prescriptions.length === 0) ? (
              <p className="text-gray-500 text-center py-10">No prescriptions found.</p>
            ) : (
              prescriptions.map((prescription) => (
                <div key={prescription.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center">
                          <FileText className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 mb-1">{prescription.notes || "General Checkup"}</h3>
                          <p className="text-gray-600">Prescribed by {prescription.doctor_name}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" /><span>{prescription.date}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setViewPrescriptionData(prescription);
                          setCurrentScreen('view-prescription');
                        }}
                        className="flex items-center gap-2 bg-teal-50 text-teal-700 px-4 py-2 rounded-xl font-medium hover:bg-teal-100 transition-all border border-teal-100"
                      >
                        👁️ View
                      </button>
                    </div>
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Medications:</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2"></span>
                          <span className="text-gray-700">{prescription.medicines}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    );
  };

  // Render logic
  if (!isLoggedIn) {
    return currentScreen === 'signup' ? (
      <SignupScreen 
        setCurrentScreen={setCurrentScreen} 
        setUserType={setUserType}
        setIsLoggedIn={setIsLoggedIn}
        setUserName={setUserName}
      />
    ) : (
      <LoginScreen 
        // 👇 Ye saari lines ZAROORI hain tabhi buttons chalenge
        setUserType={setUserType}
        setCurrentScreen={setCurrentScreen}
        setIsLoggedIn={setIsLoggedIn}
        setUserName={setUserName}
      />
    );
  }

  switch (currentScreen) {
    case 'dashboard':
      return userType === 'doctor' 
        ? <DoctorDashboard 
            handleLogout={handleLogout} 
            setCurrentScreen={setCurrentScreen} 
            doctorSchedule={doctorSchedule} 
            handleStatusUpdate={handleStatusUpdate} 
            userName={userName} 
            setCallPartner={setCallPartner} 
            setSelectedRxPatient={setSelectedRxPatient} 
          />
        : <PatientDashboard 
            handleLogout={handleLogout} 
            setCurrentScreen={setCurrentScreen} 
            setReviewDoctorId={setReviewDoctorId} 
            appointments={appointments} 
            upcomingAppointment={upcomingAppointment} 
            userName={userName} 
            setCallPartner={setCallPartner} 
          />;
    case 'doctors':
      return <DoctorsScreen />;
    case 'create-profile':
      return <DoctorProfileForm setCurrentScreen={setCurrentScreen} setUserType={setUserType} />;
    case 'booking':
      return <BookingScreen />;
    case 'upload-report':
      return <UploadReportScreen setCurrentScreen={setCurrentScreen} doctorSchedule={doctorSchedule} onSuccess={handlePrescriptionSuccess} />;
    case 'view-prescription':
      return <PrescriptionViewScreen prescription={viewPrescriptionData} setCurrentScreen={setCurrentScreen} />;
    case 'medical-records':
      return <MedicalRecordsScreen setCurrentScreen={setCurrentScreen} />;
    case 'consultation':
      return <ConsultationScreen callPartner={callPartner} userType={userType} />;
    case 'write-prescription':
      return <WritePrescriptionScreen setCurrentScreen={setCurrentScreen} selectedRxPatient={selectedRxPatient} onSuccess={handlePrescriptionSuccess} />;
    case 'rate-doctor':
      return <RateDoctorScreen doctorId={reviewDoctorId} setCurrentScreen={setCurrentScreen} />;
    case 'consultation':
        return (
          <ConsultationScreen 
              callPartner={callPartner} 
              userName={userName} // 👈 YE LINE ADD KARNI HAI BAS
              setCurrentScreen={setCurrentScreen} 
          />
        );
    case 'prescriptions':
      return <PrescriptionsScreen prescriptions={prescriptions} setCurrentScreen={setCurrentScreen} setViewPrescriptionData={setViewPrescriptionData} />;
    default:
      return <PatientDashboard handleLogout={handleLogout} setCurrentScreen={setCurrentScreen} setReviewDoctorId={setReviewDoctorId} appointments={appointments} upcomingAppointment={upcomingAppointment} userName={userName} setCallPartner={setCallPartner} />;
  }
}

export default App;