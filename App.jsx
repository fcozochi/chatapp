// ============================================================
// FILE: src/App.jsx - CHATAPP COMPLETE
// API: https://chat.flashchatai.com
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, SafeAreaView,
  Image, ActivityIndicator, Dimensions
} from "react-native-web";

// ============================================================
// WEB ALERT
// ============================================================
const WebAlert = {
  alert: (title, message, buttons) => {
    if (buttons && buttons.length > 0) {
      const text = message ? title + "\n\n" + message : title;
      if (window.confirm(text)) {
        const ok = buttons.find(b => b.style === 'destructive' || b.text === 'OK' || b.text === 'Delete' || b.text === 'Logout' || b.text === 'Block');
        if (ok && ok.onPress) ok.onPress();
      } else {
        const cancel = buttons.find(b => b.style === 'cancel');
        if (cancel && cancel.onPress) cancel.onPress();
      }
    } else {
      window.alert(message ? title + "\n\n" + message : title);
    }
  },
  prompt: (title, message, buttons, defaultValue) => {
    defaultValue = defaultValue || '';
    const input = window.prompt(message ? title + "\n\n" + message : title, defaultValue);
    if (input !== null) {
      const ok = buttons.find(b => b.text === 'OK' || b.text === 'Ask' || b.text === 'Delete');
      if (ok && ok.onPress) ok.onPress(input);
    } else {
      const cancel = buttons.find(b => b.style === 'cancel');
      if (cancel && cancel.onPress) cancel.onPress();
    }
  }
};
const Alert = WebAlert;

const API = "https://chat.flashchatai.com";

const REGIONS = [
  { id: 'all', name: 'All', color: '#FFFFFF' },
  { id: 'europe', name: 'Europe', color: '#4CAF50' },
  { id: 'africa', name: 'Africa', color: '#FF9800' },
  { id: 'asia', name: 'Asia', color: '#E91E63' },
  { id: 'americas', name: 'Americas', color: '#2196F3' },
  { id: 'middle_east', name: 'Middle East', color: '#9C27B0' },
  { id: 'oceania', name: 'Oceania', color: '#00BCD4' }
];

function Logo({ size = 200 }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Image source={{ uri: "/icon.png" }} style={{ width: size, height: size, resizeMode: "contain" }} />
    </View>
  );
}

function BackButton({ onPress, text = "< Back" }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignSelf: "flex-start", marginBottom: 12, padding: 8 }}>
      <Text style={{ color: "#66E0A0", fontSize: 19, fontWeight: "700" }}>{text}</Text>
    </TouchableOpacity>
  );
}

function XButton({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.xButton}>
      <Text style={styles.xButtonText}>X</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [screen, setScreen] = useState("home");
  const [mainTab, setMainTab] = useState("chats");
  const [activeDM, setActiveDM] = useState(null);
  const [activeRegionFilter, setActiveRegionFilter] = useState("all");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [regStep, setRegStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [ageError, setAgeError] = useState("");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("europe");
  const [about, setAbout] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");

  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [isPremium, setIsPremium] = useState(false);

  const apiCall = useCallback(async (endpoint, method = "GET", body = null) => {
    const headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    try {
      const response = await fetch(API + endpoint, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Invalid server response"); }
      if (!response.ok) throw new Error(data.error || data.message || "Request failed");
      return data;
    } catch (err) { throw new Error(err.message || "Network error"); }
  }, [token]);

  // ============================================================
  // LOGIN
  // ============================================================
  const handleLogin = async () => {
    if (!email || !email.trim()) { setError("Please enter username or email"); return; }
    if (!password || password.length < 6) { setError("Password must be 6+ characters"); return; }
    setLoading(true); setError("");
    try {
      const identifier = email.trim();
      const data = await apiCall("/api/auth/login", "POST", {
        username: identifier,
        email: identifier,
        password
      });
      if (data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        setIsPremium(data.isPremium || false);
        const isAdminUser = data.user && (data.user.role === 'admin' || data.user.is_admin === true || data.user.username === 'fcozo');
        setIsAdmin(isAdminUser);
        setScreen("main");
        setMainTab("chats");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) { setError(err.message || "Login failed"); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!email || !email.includes("@")) { setError("Valid email required"); return; }
    if (!phone || phone.length < 10) { setError("Valid phone required"); return; }
    if (!username || username.trim().length < 2) { setError("Username 2+ characters"); return; }
    if (!password || password.length < 6) { setError("Password 6+ characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!age || parseInt(age) < 18) { setError("Must be 18+"); return; }
    if (!gender) { setError("Select gender"); return; }
    if (!region) { setError("Select region"); return; }
    setLoading(true); setError("");
    try {
      const data = await apiCall("/api/auth/register", "POST", {
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password,
        display_name: username.trim()
      });
      if (data.token) {
        // Update region if backend accepted the extra field
        setToken(data.token);
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        setScreen("main");
        setMainTab("chats");
      } else setError(data.error || "Registration failed");
    } catch (err) { setError(err.message || "Registration failed"); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: () => {
        setIsLoggedIn(false); setToken(""); setCurrentUser(null); setIsAdmin(false);
        setScreen("home"); setActiveDM(null);
      }}
    ]);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotEmail.includes("@")) { setError("Enter a valid email"); return; }
    setLoading(true); setError("");
    try {
      const r = await apiCall("/api/auth/forgot-password", "POST", { email: forgotEmail.toLowerCase().trim() });
      if (r.success) { Alert.alert("Sent", "Reset link sent."); setScreen("login"); }
      else setError(r.error || "Failed to send");
    } catch (err) { setError(err.message || "Failed to send"); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { setResetError("Password 6+ characters"); return; }
    if (newPassword !== confirmPassword) { setResetError("Passwords do not match"); return; }
    setLoading(true); setResetError("");
    try {
      const r = await apiCall("/api/auth/reset-password", "POST", { token: resetToken, password: newPassword });
      if (r.success) {
        Alert.alert("Success", "Password reset. Please sign in.");
        setNewPassword(""); setConfirmPassword(""); setResetToken("");
        setScreen("login");
      } else setResetError(r.error || "Failed to reset");
    } catch (err) { setResetError(err.message || "Failed to reset"); }
    finally { setLoading(false); }
  };

  // ============================================================
  // LOAD CONVERSATIONS + USERS
  // ============================================================
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiCall("/api/messages/conversations");
      setConversations(r.conversations || []);
    } catch (e) { setConversations([]); }
    finally { setLoading(false); }
  }, [apiCall]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiCall("/api/users");
      setUsers(r.users || []);
    } catch (e) { setUsers([]); }
    finally { setLoading(false); }
  }, [apiCall]);

  const openDM = useCallback(async (user) => {
    setActiveDM(user);
    setScreen("chat");
    setLoading(true);
    try {
      const r = await apiCall("/api/messages/" + user.id);
      setMessages(r.messages || []);
    } catch (e) { setMessages([]); }
    finally { setLoading(false); }
  }, [apiCall]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeDM) return;
    setSending(true);
    try {
      const r = await apiCall("/api/messages", "POST", {
        recipient_id: activeDM.id,
        content: newMessage.trim()
      });
      if (r.success) {
        setMessages(prev => [...prev, {
          id: (r.message && r.message.id) || Date.now(),
          sender_id: currentUser && currentUser.id,
          recipient_id: activeDM.id,
          content: newMessage.trim(),
          created_at: new Date().toISOString()
        }]);
        setNewMessage("");
      } else {
        Alert.alert("Error", r.error || "Failed to send");
      }
    } catch (e) { Alert.alert("Error", e.message || "Failed to send"); }
    finally { setSending(false); }
  };

  useEffect(() => {
    if (screen === "main" && isLoggedIn) {
      loadConversations();
      loadUsers();
    }
  }, [screen, isLoggedIn, loadConversations, loadUsers]);

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if ((path.includes('reset') || path.includes('reset-password')) && t) {
      setResetToken(t);
      setScreen('resetPassword');
    }
  }, []);

  const filteredUsers = activeRegionFilter === "all"
    ? users
    : users.filter(u => u.region === activeRegionFilter);

  // ============================================================
  // RENDER: HOME
  // ============================================================
  const renderHome = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <ScrollView contentContainerStyle={styles.centerContent}>
        <Logo size={200} />
        <Text style={styles.title}>ChatApp</Text>
        <Text style={styles.subtitle}>Connect with people around the world</Text>
        <View style={styles.featuresRow}>
          <Text style={styles.feature}>Europe</Text>
          <Text style={styles.feature}>Africa</Text>
          <Text style={styles.feature}>Asia</Text>
          <Text style={styles.feature}>Americas</Text>
        </View>
        <TouchableOpacity style={styles.btnGreen} onPress={() => setScreen("ageGate")}>
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGreen} onPress={() => { setRegStep(1); setScreen("register"); setError(""); }}>
          <Text style={styles.btnText}>Create Account</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>18+ only. Be respectful.</Text>
      </ScrollView>
    </SafeAreaView>
  );

  const renderAgeGate = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.centerContent}>
        <BackButton onPress={() => setScreen("home")} />
        <Logo size={120} />
        <Text style={styles.title}>Age Verification</Text>
        <Text style={styles.subtitle}>You must be 18 or older</Text>
        <TextInput style={styles.input} value={ageInput} onChangeText={(t) => { setAgeInput(t.replace(/[^0-9]/g, "")); setAgeError(""); }} placeholder="Enter your age" placeholderTextColor="#888" keyboardType="numeric" maxLength={2} />
        {ageError ? <Text style={styles.errorText}>{ageError}</Text> : null}
        <TouchableOpacity style={styles.btnGreen} onPress={() => {
          const n = parseInt(ageInput);
          if (!ageInput || isNaN(n)) { setAgeError("Please enter your age"); return; }
          if (n < 18) { setAgeError("You must be 18 or older"); return; }
          setAge(ageInput); setScreen("login");
        }}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderLogin = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.centerContent}>
        <BackButton onPress={() => setScreen("home")} />
        <Logo size={100} />
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in with username or email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Username or Email" placeholderTextColor="#888" autoCapitalize="none" />
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#888" secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
            <Text style={styles.showButtonText}>{showPassword ? "HIDE" : "SHOW"}</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={[styles.btnGreen, { opacity: loading ? 0.6 : 1 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setScreen("forgotPassword"); setError(""); setForgotEmail(""); }}>
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setRegStep(1); setScreen("register"); setError(""); }}>
          <Text style={styles.linkText}>Create Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderForgotPassword = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.centerContent}>
        <BackButton onPress={() => { setScreen("login"); setError(""); }} />
        <Logo size={100} />
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email</Text>
        <TextInput style={styles.input} value={forgotEmail} onChangeText={setForgotEmail} placeholder="Email" placeholderTextColor="#888" autoCapitalize="none" keyboardType="email-address" />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={[styles.btnGreen, { opacity: loading ? 0.6 : 1 }]} onPress={handleForgotPassword} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderResetPassword = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.centerContent}>
        <BackButton onPress={() => { setScreen("login"); setResetError(""); }} />
        <Logo size={100} />
        <Text style={styles.title}>Set New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} value={newPassword} onChangeText={setNewPassword} placeholder="New Password (6+)" placeholderTextColor="#888" secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
            <Text style={styles.showButtonText}>{showPassword ? "HIDE" : "SHOW"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password" placeholderTextColor="#888" secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
            <Text style={styles.showButtonText}>{showPassword ? "HIDE" : "SHOW"}</Text>
          </TouchableOpacity>
        </View>
        {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
        <TouchableOpacity style={[styles.btnGreen, { opacity: loading ? 0.6 : 1 }]} onPress={handleResetPassword} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Reset Password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderRegister = () => {
    const step1 = () => (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email *" placeholderTextColor="#888" autoCapitalize="none" />
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone *" placeholderTextColor="#888" keyboardType="phone-pad" />
        <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Username *" placeholderTextColor="#888" />
        <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Age * (18+)" placeholderTextColor="#888" keyboardType="numeric" />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={styles.btnGreen} onPress={() => {
          if (!email || !email.includes("@")) { setError("Valid email required"); return; }
          if (!phone || phone.length < 10) { setError("Valid phone required"); return; }
          if (!username.trim()) { setError("Username required"); return; }
          if (!age || parseInt(age) < 18) { setError("Must be 18+"); return; }
          setError(""); setRegStep(2);
        }}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );

    const step2 = () => (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.tagWrap}>
          {["Male", "Female", "Other"].map(g => (
            <TouchableOpacity key={g} style={[styles.tag, gender === g.toLowerCase() && styles.tagActive]} onPress={() => setGender(g.toLowerCase())}>
              <Text style={[styles.tagText, gender === g.toLowerCase() && styles.tagTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Your Region</Text>
        <View style={styles.tagWrap}>
          {REGIONS.filter(r => r.id !== 'all').map(r => (
            <TouchableOpacity key={r.id} style={[styles.tag, region === r.id && styles.tagActive]} onPress={() => setRegion(r.id)}>
              <Text style={[styles.tagText, region === r.id && styles.tagTextActive]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={() => setRegStep(1)}>
            <Text style={styles.btnOutlineText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnGreen, { flex: 2 }]} onPress={() => {
            if (!gender) { setError("Select gender"); return; }
            if (!region) { setError("Select region"); return; }
            setError(""); setRegStep(3);
          }}>
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    const step3 = () => (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Security</Text>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="Password (6+)" placeholderTextColor="#888" secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
            <Text style={styles.showButtonText}>{showPassword ? "HIDE" : "SHOW"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm" placeholderTextColor="#888" secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
            <Text style={styles.showButtonText}>{showPassword ? "HIDE" : "SHOW"}</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={() => setRegStep(2)}>
            <Text style={styles.btnOutlineText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnGreen, { flex: 2, opacity: loading ? 0.6 : 1 }]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Complete</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <BackButton onPress={() => { setScreen("home"); setError(""); }} />
          <Logo size={80} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Step {regStep} of 3</Text>
          {regStep === 1 ? step1() : regStep === 2 ? step2() : step3()}
        </ScrollView>
      </SafeAreaView>
    );
  };

  // ============================================================
  // RENDER: MAIN (Chats + People tabs)
  // ============================================================
  const renderMain = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mainTab === "chats" ? "Chats" : "People"}
        </Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {isAdmin && (
            <TouchableOpacity onPress={() => setScreen("admin")}>
              <Text style={[styles.headerAction, { color: "#FFD700" }]}>ADMIN</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setScreen("profile")}>
            <Text style={styles.headerAction}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, mainTab === "chats" && styles.tabBtnActive]}
          onPress={() => setMainTab("chats")}
        >
          <Text style={[styles.tabBtnText, mainTab === "chats" && styles.tabBtnTextActive]}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, mainTab === "people" && styles.tabBtnActive]}
          onPress={() => setMainTab("people")}
        >
          <Text style={[styles.tabBtnText, mainTab === "people" && styles.tabBtnTextActive]}>People</Text>
        </TouchableOpacity>
      </View>

      {mainTab === "people" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionPillsWrap}>
          {REGIONS.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.regionPill, activeRegionFilter === r.id && styles.regionPillActive, { borderColor: r.color }]}
              onPress={() => setActiveRegionFilter(r.id)}
            >
              <Text style={[styles.regionPillText, activeRegionFilter === r.id && { color: r.color, fontWeight: "800" }]}>
                {r.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color="#4CAF50" style={{ marginTop: 30 }} />
        ) : mainTab === "chats" ? (
          conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No conversations yet</Text>
              <Text style={styles.emptyStateSub}>Switch to People tab to start a chat</Text>
              <TouchableOpacity style={[styles.btnGreen, { marginTop: 20 }]} onPress={() => setMainTab("people")}>
                <Text style={styles.btnText}>Browse People</Text>
              </TouchableOpacity>
            </View>
          ) : (
            conversations.map(c => (
              <TouchableOpacity
                key={c.conversation_id}
                style={styles.convItem}
                onPress={() => openDM({ id: c.other_user_id, username: c.other_user_username, display_name: c.other_user_display_name, is_online: c.other_user_is_online })}
              >
                <View style={styles.convAvatar}>
                  <Text style={styles.convAvatarText}>{(c.other_user_username || "U")[0].toUpperCase()}</Text>
                  {c.other_user_is_online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convName}>{c.other_user_display_name || c.other_user_username}</Text>
                  <Text style={styles.convLast} numberOfLines={1}>{c.last_message || "Start a conversation"}</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          filteredUsers.length === 0 ? (
            <Text style={styles.muted}>No users in this region yet.</Text>
          ) : (
            filteredUsers.map(u => (
              <TouchableOpacity
                key={u.id}
                style={styles.convItem}
                onPress={() => openDM(u)}
              >
                <View style={styles.convAvatar}>
                  <Text style={styles.convAvatarText}>{(u.username || "U")[0].toUpperCase()}</Text>
                  {u.is_online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.convName}>{u.display_name || u.username}</Text>
                  <Text style={styles.convLast}>
                    @{u.username}
                    {u.region ? "  •  " + (REGIONS.find(r => r.id === u.region)?.name || u.region) : ""}
                    {u.age ? "  •  " + u.age + " yrs" : ""}
                  </Text>
                </View>
                <Text style={styles.dmArrow}>→</Text>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );

  // ============================================================
  // RENDER: CHAT (DM)
  // ============================================================
  const renderChat = () => {
    if (!activeDM) return null;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setScreen("main"); setMessages([]); setNewMessage(""); }}>
            <Text style={styles.headerAction}>&lt; Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{activeDM.display_name || activeDM.username}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.chatBox}>
          <ScrollView
            style={styles.chatScroll}
            contentContainerStyle={styles.chatScrollContent}
            keyboardShouldPersistTaps="always"
          >
            {messages.length === 0 ? (
              <Text style={styles.chatEmpty}>No messages yet. Say hello!</Text>
            ) : (
              messages.map((m, idx) => {
                const isMine = currentUser && (m.sender_id === currentUser.id);
                return (
                  <View key={m.id || idx} style={[styles.messageRow, isMine ? styles.messageRowMine : null]}>
                    <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : null]}>
                      <Text style={styles.messageText}>{m.content || m.text || m.message}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={styles.chatInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#AAAAAA"
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              autoComplete="off"
              autoCorrect="false"
              spellCheck={false}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || sending) ? styles.sendButtonDisabled : null]}
              onPress={sendMessage}
              disabled={sending || !newMessage.trim()}
            >
              <Text style={styles.sendButtonText}>{sending ? "..." : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  // ============================================================
  // RENDER: PROFILE
  // ============================================================
  const renderProfile = () => {
    if (!currentUser) return null;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen("main")}>
            <Text style={styles.headerAction}>&lt; Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.headerAction}>Logout</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileBox}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{(currentUser.username || "U")[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.profileName}>{currentUser.display_name || currentUser.username}</Text>
            <Text style={styles.profileHandle}>@{currentUser.username}</Text>
            {isPremium ? <Text style={styles.profilePremium}>Premium Member</Text> : null}
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Details</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{currentUser.email || "-"}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Age</Text><Text style={styles.infoValue}>{currentUser.age || "-"}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Region</Text><Text style={styles.infoValue}>{currentUser.region || "-"}</Text></View>
          </View>
          <TouchableOpacity style={styles.btnGreen} onPress={() => setScreen("main")}>
            <Text style={styles.btnText}>Back to Chats</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // ============================================================
  // RENDER: ADMIN
  // ============================================================
  const renderAdmin = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setScreen("main")}>
          <Text style={styles.headerAction}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#FFD700" }]}>ADMIN</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.adminStat}>
          <Text style={styles.adminStatValue}>{users.length}</Text>
          <Text style={styles.adminStatLabel}>Total Users</Text>
        </View>
        <View style={styles.adminStat}>
          <Text style={styles.adminStatValue}>{users.filter(u => u.is_online).length}</Text>
          <Text style={styles.adminStatLabel}>Online Now</Text>
        </View>
        <View style={styles.adminStat}>
          <Text style={styles.adminStatValue}>{conversations.length}</Text>
          <Text style={styles.adminStatLabel}>Your Conversations</Text>
        </View>
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>All Users ({users.length})</Text>
        {users.map(u => (
          <View key={u.id} style={styles.adminUserItem}>
            <Text style={styles.adminUserName}>{u.username}</Text>
            <Text style={styles.adminUserEmail}>{u.region || "(no region)"} · {u.is_online ? "online" : "offline"}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  // ============================================================
  // SCREEN ROUTER
  // ============================================================
  const renderScreen = () => {
    if (screen === "home") return renderHome();
    if (screen === "ageGate") return renderAgeGate();
    if (screen === "login") return renderLogin();
    if (screen === "forgotPassword") return renderForgotPassword();
    if (screen === "resetPassword") return renderResetPassword();
    if (screen === "register") return renderRegister();
    if (screen === "main") return renderMain();
    if (screen === "chat") return renderChat();
    if (screen === "profile") return renderProfile();
    if (screen === "admin" && isAdmin) return renderAdmin();
    return renderHome();
  };

  return (
    <View style={styles.appOuter}>
      <View style={styles.appBox}>
        <View style={styles.appShine} />
        <View style={styles.appInnerGlow} />
        <View style={styles.appContent}>
          {renderScreen()}
        </View>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  appOuter: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 15,
  },
  appBox: {
    width: "90%",
    maxWidth: 1400,
    minHeight: "92vh",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 28,
    overflow: "hidden",
    flexDirection: "column",
    position: "relative",
    backgroundColor: "rgba(15,28,58,0.55)",
    backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.08) 100%)",
    backdropFilter: "blur(30px) saturate(180%)",
    WebkitBackdropFilter: "blur(30px) saturate(180%)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(255,255,255,0.15)",
  },
  appShine: {
    position: "absolute", top: 0, left: 0, right: 0, height: "35%",
    backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0) 100%)",
    pointerEvents: "none", zIndex: 0,
  },
  appInnerGlow: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: "radial-gradient(ellipse at top left, rgba(140,200,255,0.18) 0%, transparent 60%)",
    pointerEvents: "none", zIndex: 0,
  },
  appContent: { flex: 1, position: "relative", zIndex: 1 },

  container: { flex: 1, backgroundColor: "transparent" },
  centerContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  scrollContent: { padding: 20 },

  title: { color: "#FFF", fontSize: 40, fontWeight: "800", marginTop: 16, textAlign: "center" },
  subtitle: { color: "#DDD", fontSize: 19, marginTop: 8, marginBottom: 28, textAlign: "center" },
  sectionTitle: { color: "#FFF", fontSize: 24, fontWeight: "700", marginTop: 16, marginBottom: 12 },
  muted: { color: "#AAA", fontSize: 18, fontStyle: "italic", textAlign: "center", marginTop: 30 },
  errorText: { color: "#FF6666", fontSize: 18, textAlign: "center", marginTop: 10 },
  linkText: { color: "#66E0A0", fontSize: 19, marginTop: 16, textAlign: "center" },
  footer: { color: "#888", fontSize: 15, marginTop: 28, textAlign: "center" },

  featuresRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginVertical: 24 },
  feature: { color: "#B0E0FF", fontSize: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backdropFilter: "blur(8px)" },

  btnGreen: { backgroundColor: "rgba(76,175,80,0.85)", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 40, alignItems: "center", marginVertical: 10, minWidth: 300, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  btnText: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  btnOutline: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 40, borderWidth: 1, borderColor: "rgba(76,175,80,0.7)", alignItems: "center", marginVertical: 10 },
  btnOutlineText: { color: "#66E0A0", fontSize: 20, fontWeight: "700" },

  input: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 18, color: "#FFF", fontSize: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", marginBottom: 12, width: "100%" },
  passwordContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", marginBottom: 12, width: "100%", minHeight: 60 },
  passwordInput: { flex: 1, padding: 18, color: "#FFF", fontSize: 20, minHeight: 60 },
  showButton: { padding: 16 },
  showButtonText: { color: "#66E0A0", fontSize: 16, fontWeight: "800" },

  formContainer: { width: "100%", maxWidth: 500 },
  label: { color: "#DDD", fontSize: 19, fontWeight: "600", marginTop: 14, marginBottom: 10 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  tag: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)" },
  tagActive: { borderColor: "rgba(76,175,80,0.9)", backgroundColor: "rgba(76,175,80,0.25)" },
  tagText: { color: "#CCC", fontSize: 18 },
  tagTextActive: { color: "#B0FFC0", fontWeight: "700" },
  row: { flexDirection: "row", gap: 12, width: "100%", marginTop: 16 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" },
  headerTitle: { color: "#FFF", fontSize: 26, fontWeight: "700" },
  headerAction: { color: "#66E0A0", fontSize: 19, fontWeight: "700" },

  tabBar: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.2)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  tabBtn: { flex: 1, paddingVertical: 16, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: "#4CAF50" },
  tabBtnText: { color: "#AAA", fontSize: 20, fontWeight: "600" },
  tabBtnTextActive: { color: "#FFF", fontWeight: "800" },

  regionPillsWrap: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  regionPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 2, backgroundColor: "rgba(255,255,255,0.04)", marginRight: 8 },
  regionPillActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  regionPillText: { color: "#CCC", fontSize: 16, fontWeight: "600" },

  convItem: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", gap: 14 },
  convAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(76,175,80,0.7)", alignItems: "center", justifyContent: "center", position: "relative" },
  convAvatarText: { color: "#FFF", fontSize: 26, fontWeight: "700" },
  onlineDot: { position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#4CAF50", borderWidth: 2, borderColor: "#0A1428" },
  convName: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  convLast: { color: "#BBB", fontSize: 16, marginTop: 4 },
  dmArrow: { color: "#66E0A0", fontSize: 26, fontWeight: "700" },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyStateText: { color: "#FFF", fontSize: 22, fontWeight: "700" },
  emptyStateSub: { color: "#AAA", fontSize: 17, marginTop: 8, textAlign: "center" },

  chatBox: { flex: 1, margin: 16, backgroundColor: "rgba(15,30,60,0.35)", backdropFilter: "blur(16px)", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderRadius: 16, overflow: "hidden", flexDirection: "column", minHeight: 300 },
  chatScroll: { flex: 1, backgroundColor: "transparent" },
  chatScrollContent: { padding: 20, paddingBottom: 10, flexGrow: 1 },
  chatEmpty: { color: "#AAA", fontSize: 19, fontStyle: "italic", textAlign: "center", marginTop: 50 },
  messageRow: { flexDirection: "row", marginBottom: 14, justifyContent: "flex-start" },
  messageRowMine: { justifyContent: "flex-end" },
  messageBubble: { maxWidth: "78%", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  messageBubbleMine: { backgroundColor: "rgba(76,175,80,0.35)", borderColor: "rgba(76,175,80,0.6)" },
  messageText: { color: "#FFF", fontSize: 19, lineHeight: 26 },
  inputBar: { flexDirection: "row", padding: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(10,20,40,0.7)", gap: 12, alignItems: "center" },
  chatInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, color: "#FFFFFF", fontSize: 19, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", minHeight: 54, maxHeight: 130, outlineStyle: "none" },
  sendButton: { backgroundColor: "rgba(76,175,80,0.9)", borderRadius: 27, paddingVertical: 16, paddingHorizontal: 26, minHeight: 54, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  sendButtonDisabled: { backgroundColor: "rgba(46,79,49,0.6)", opacity: 0.7 },
  sendButtonText: { color: "#FFFFFF", fontSize: 19, fontWeight: "700" },

  profileBox: { alignItems: "center", marginBottom: 28 },
  profileAvatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(76,175,80,0.85)", alignItems: "center", justifyContent: "center", marginBottom: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  profileAvatarText: { color: "#FFF", fontSize: 60, fontWeight: "700" },
  profileName: { color: "#FFF", fontSize: 34, fontWeight: "700" },
  profileHandle: { color: "#AAA", fontSize: 20, marginTop: 4 },
  profilePremium: { color: "#FFD700", fontSize: 19, marginTop: 8 },

  infoCard: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 20, marginBottom: 20 },
  infoTitle: { color: "#FFF", fontSize: 22, fontWeight: "700", marginBottom: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  infoLabel: { color: "#BBB", fontSize: 18 },
  infoValue: { color: "#FFF", fontSize: 18, fontWeight: "500" },

  adminStat: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 20, marginBottom: 14, borderLeftWidth: 5, borderLeftColor: "rgba(76,175,80,0.9)" },
  adminStatValue: { color: "#66E0A0", fontSize: 38, fontWeight: "800" },
  adminStatLabel: { color: "#BBB", fontSize: 17, marginTop: 8 },
  adminUserItem: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, marginBottom: 10 },
  adminUserName: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  adminUserEmail: { color: "#BBB", fontSize: 16, marginTop: 4 },

  xButton: { position: "absolute", top: 20, right: 20, zIndex: 10, backgroundColor: "rgba(255,68,68,0.85)", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  xButtonText: { color: "#FFF", fontSize: 22, fontWeight: "700" },
});