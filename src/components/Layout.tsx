import { useState } from 'react'; // Add useState
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    FileText,
    TestTube,
    Gift,
    Archive as ArchiveIcon,
    Settings,
    Moon,
    Sun,
    Save,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Users
} from 'lucide-react';
import { useDMLab } from '../context/DMLabContext';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout() {
    const { state, actions } = useDMLab();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const primaryNav = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: FileText, label: 'Daily Log', path: '/log' },
        { icon: Users, label: 'Leads', path: '/leads' },
        { icon: TestTube, label: 'Experiments', path: '/experiments' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const secondaryNav = [
        { icon: Gift, label: 'Offers', path: '/offers' },
        { icon: ArchiveIcon, label: 'Archive', path: '/archive' },
    ];

    const navItems = [...primaryNav, ...secondaryNav];
    const pageTitle = navItems.find(i => i.path === location.pathname)?.label || 'DM Lab';
    const pageSubtitle = pageTitle === 'Dashboard'
        ? 'Overview of your outreach performance'
        : `Manage your ${pageTitle.toLowerCase()}`;

    const SidebarContent = () => (
        <>
            <div className={clsx("flex items-center gap-3 mb-8 px-2 transition-all duration-300", isCollapsed ? "justify-center" : "justify-start")}>
                {isCollapsed ? (
                    <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
                        EH
                    </div>
                ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-3 py-2">
                        <div className="h-10 w-10 rounded-2xl bg-black/60 border border-border/60 flex items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt="Elite Health" className="h-8 w-auto" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Elite Health</div>
                            <div className="text-sm font-semibold text-foreground">DM Lab</div>
                        </div>
                    </div>
                )}
            </div>

            <nav className="flex flex-col gap-2 flex-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) => clsx(
                                "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group font-medium text-sm",
                                isCollapsed ? "justify-center" : "px-4",
                                isActive
                                    ? "text-primary bg-primary/10 shadow-sm"
                                    : "text-secondary-foreground hover:text-foreground hover:bg-secondary/50"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeNav"
                                    className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <item.icon size={20} className={clsx(isActive && "text-primary")} />
                            {!isCollapsed && <span className="relative z-10 whitespace-nowrap">{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {!isCollapsed && (
                <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/40 p-4 text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground mb-1">Elite Health KPI System</div>
                    <div>Track CR, PRR, ABR, and Booked KPI with experiment validity rules built-in.</div>
                </div>
            )}

            <button
                onClick={actions.toggleTheme}
                className={clsx(
                    "flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-secondary-foreground hover:bg-secondary/50 transition-colors mt-auto border border-transparent hover:border-border",
                    isCollapsed ? "justify-center" : ""
                )}
            >
                {state.settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                {!isCollapsed && <span>{state.settings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>}
            </button>
        </>
    );

    return (
        <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? 80 : 288 }}
                className="hidden md:flex bg-card border-r border-border h-full flex-col p-4 z-20 glass shadow-2xl relative transition-all duration-300"
            >
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-10 bg-card border border-border rounded-full p-1 text-secondary-foreground hover:text-foreground shadow-sm z-50 hover:bg-secondary/80 transition-colors"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
                <SidebarContent />
            </motion.aside>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border z-50 p-6 flex flex-col md:hidden glass"
                        >
                            <div className="absolute top-4 right-4">
                                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-secondary-foreground hover:text-foreground">
                                    <X size={24} />
                                </button>
                            </div>
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none" />

                <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-4 py-4 md:px-8 md:py-6 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden p-2 text-secondary-foreground hover:text-foreground hover:bg-secondary/20 rounded-lg transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="md:hidden h-8 w-8 rounded-xl bg-black/70 border border-border/60 flex items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt="Elite Health" className="h-6 w-auto" />
                        </div>
                        <div>
                            <div className="hidden md:block section-kicker">Elite Health DM Lab</div>
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{pageTitle}</h1>
                            <p className="hidden md:block text-secondary-foreground text-sm mt-1">
                                {pageSubtitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={actions.toggleTheme}
                            className="hidden md:inline-flex items-center justify-center rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/70"
                            aria-label="Toggle theme"
                        >
                            {state.settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button
                            onClick={() => actions.saveData()}
                            className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:brightness-110 transition-all shadow-lg shadow-primary/25 active:scale-95 text-sm md:text-base"
                        >
                            <Save size={18} />
                            <span className="hidden md:inline">Save</span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-24 md:pb-10 relative z-10 scrollbar-thin">
                    <Outlet />
                </main>
            </div>

            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-xl mobile-nav">
                <div className="grid grid-cols-5 gap-1 px-3 py-2">
                    {primaryNav.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => clsx(
                                "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition",
                                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon size={18} />
                            <span className="truncate">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
