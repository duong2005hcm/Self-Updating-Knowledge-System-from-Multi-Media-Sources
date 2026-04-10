import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar"; // Tái sử dụng Sidebar nhưng đổi menu

export default function AdminLayout({ user }) {
    const [activeTab, setActiveTab] = useState("users"); // users | knowledge

    return (
        <div className="app-root">
            <div className="sidebar admin-sidebar">
                <h2 className="brand-name">RAG ADMIN</h2>
                <nav>
                    <button onClick={() => setActiveTab("users")}>Quản lý User</button>
                    <button onClick={() => setActiveTab("knowledge")}>Hệ thống tri thức</button>
                </nav>
            </div>

            <div className="main-area">
                <header className="taskbar">
                    <div className="taskbar-title">Quản trị hệ thống</div>
                    <div className="user-info">{user.name} (Admin)</div>
                </header>

                <div className="chat-body admin-content">
                    {activeTab === "users" ? <UserManagement /> : <KnowledgeManagement />}
                </div>
            </div>
        </div>
    );
}