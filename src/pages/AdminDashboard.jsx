import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import MapComponent from '../components/MapComponent';
import * as XLSX from 'xlsx';
import { Users, Truck, CheckCircle2, MapPin, Search, RefreshCw, Calendar, ArrowLeft, Download, Briefcase, MessageSquare, X, Clock, Activity, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('admin_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [projectFilter, setProjectFilter] = useState('');
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState('month');
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [exportFromDate, setExportFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportToDate, setExportToDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportEngineerId, setExportEngineerId] = useState('');
  const [exportProjectName, setExportProjectName] = useState('');

  const [showAllEngineersMode, setShowAllEngineersMode] = useState(false);
  const [allEngineersData, setAllEngineersData] = useState([]);

  const [statModalConfig, setStatModalConfig] = useState({ isOpen: false, title: '', type: '' });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: ticketData, error } = await supabase
      .from('ticket_tracking')
      .select('*')
      .eq('date', filterDate)
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
    } else {
      setData(ticketData || []);
      // Auto-update the selected ticket if it's currently open
      setSelectedTicket(prev => {
        if (!prev) return null;
        return ticketData?.find(t => t.id === prev.id) || prev;
      });
    }
    if (!silent) setLoading(false);
  };

  const fetchAllEngineersData = async () => {
    setLoading(true);
    const { data: allData, error } = await supabase
      .from('ticket_tracking')
      .select('*')
      .order('id', { ascending: false });
      
    if (error) {
      console.error('Error fetching all engineers data:', error);
    } else {
      const uniqueEngineers = [];
      const seenIds = new Set();
      (allData || []).forEach(ticket => {
        if (!seenIds.has(ticket.employee_id) && ticket.latest_lat && ticket.latest_lng) {
          seenIds.add(ticket.employee_id);
          uniqueEngineers.push(ticket);
        }
      });
      setAllEngineersData(uniqueEngineers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 15 seconds if viewing today's date for live tracking
    const today = new Date().toISOString().split('T')[0];
    let interval;
    
    if (filterDate === today) {
      interval = setInterval(() => {
        fetchData(true); // silent fetch to prevent loading spinners
      }, 15000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [filterDate]);

  const downloadProductivity = async () => {
    setLoading(true);
    let query = supabase.from('ticket_tracking').select('*');
    let reportNameSuffix = '';

    if (exportType === 'month') {
      const [year, month] = exportMonth.split('-');
      const lastDay = new Date(year, month, 0).getDate();
      query = query.gte('date', `${exportMonth}-01`).lte('date', `${exportMonth}-${lastDay}`);
      reportNameSuffix = exportMonth;
    } else {
      query = query.gte('date', exportFromDate).lte('date', exportToDate);
      reportNameSuffix = `${exportFromDate}_to_${exportToDate}`;
    }

    if (exportEngineerId.trim() !== '') {
      query = query.eq('employee_id', exportEngineerId.trim());
      reportNameSuffix += `_${exportEngineerId.trim()}`;
    }
    
    if (exportProjectName.trim() !== '') {
      query = query.ilike('project_name', `%${exportProjectName.trim()}%`);
      reportNameSuffix += `_${exportProjectName.trim().replace(/\s+/g, '')}`;
    }

    const { data: reportData, error } = await query;

    if (error) {
      console.error('Error fetching data for report:', error);
      alert('Failed to fetch data for report.');
      setLoading(false);
      return;
    }

    const engineerStats = {};
    
    (reportData || []).forEach(ticket => {
      if (!engineerStats[ticket.employee_id]) {
        engineerStats[ticket.employee_id] = {
          name: ticket.engineer_name,
          employeeId: ticket.employee_id,
          daysActive: new Set(),
          totalTickets: 0,
          completedTickets: 0
        };
      }
      
      engineerStats[ticket.employee_id].daysActive.add(ticket.date);
      engineerStats[ticket.employee_id].totalTickets++;
      if (ticket.current_status === 'Activity Completed' || ticket.current_status === 'Leaving the Site') {
        engineerStats[ticket.employee_id].completedTickets++;
      }
    });

    const summaryData = Object.values(engineerStats).map(stat => ({
      'Employee ID': stat.employeeId,
      'Name': stat.name,
      'Total Days Active': stat.daysActive.size,
      'Total Tickets Assigned': stat.totalTickets,
      'Tickets Completed': stat.completedTickets
    }));

    // Format raw data flat per ticket
    const rawData = (reportData || []).map(ticket => {
      const hist = ticket.status_history || {};
      return {
        'Date (Activity Date)': ticket.date,
        'Activity Time': ticket.activity_time || '',
        'Activity Type': ticket.activity_type || '',
        'Project Name': ticket.project_name || '',
        'Ticket ID': ticket.ticket_id,
        'Engineer ID': ticket.employee_id,
        'Engineer Name': ticket.engineer_name,
        'Current Status': ticket.current_status,
        
        'Assigned (Date/Time)': hist['Assigned'] ? `${hist['Assigned'].date || ''} ${hist['Assigned'].time || ''}`.trim() : '',
        'Assigned (Lat/Lng)': hist['Assigned'] ? `${hist['Assigned'].lat}, ${hist['Assigned'].lng}` : '',
        
        'Start Journey (Date/Time)': hist['Start Journey'] ? `${hist['Start Journey'].date || ''} ${hist['Start Journey'].time || ''}`.trim() : '',
        'Start Journey (Lat/Lng)': hist['Start Journey'] ? `${hist['Start Journey'].lat}, ${hist['Start Journey'].lng}` : '',
        
        'Travelling (Date/Time)': hist['Travelling'] ? `${hist['Travelling'].date || ''} ${hist['Travelling'].time || ''}`.trim() : '',
        'Travelling (Lat/Lng)': hist['Travelling'] ? `${hist['Travelling'].lat}, ${hist['Travelling'].lng}` : '',
        
        'Reached Site (Date/Time)': hist['Reached the Site'] ? `${hist['Reached the Site'].date || ''} ${hist['Reached the Site'].time || ''}`.trim() : '',
        'Reached Site (Lat/Lng)': hist['Reached the Site'] ? `${hist['Reached the Site'].lat}, ${hist['Reached the Site'].lng}` : '',
        
        'Activity Completed (Date/Time)': hist['Activity Completed'] ? `${hist['Activity Completed'].date || ''} ${hist['Activity Completed'].time || ''}`.trim() : '',
        'Activity Completed (Lat/Lng)': hist['Activity Completed'] ? `${hist['Activity Completed'].lat}, ${hist['Activity Completed'].lng}` : '',
        
        'Leaving Site (Date/Time)': hist['Leaving the Site'] ? `${hist['Leaving the Site'].date || ''} ${hist['Leaving the Site'].time || ''}`.trim() : '',
        'Leaving Site (Lat/Lng)': hist['Leaving the Site'] ? `${hist['Leaving the Site'].lat}, ${hist['Leaving the Site'].lng}` : '',
        
        'Attempted (Date/Time)': hist['Attempted'] ? `${hist['Attempted'].date || ''} ${hist['Attempted'].time || ''}`.trim() : '',
        'Attempted (Lat/Lng)': hist['Attempted'] ? `${hist['Attempted'].lat}, ${hist['Attempted'].lng}` : '',
        
        'Cancelled (Date/Time)': hist['Cancelled'] ? `${hist['Cancelled'].date || ''} ${hist['Cancelled'].time || ''}`.trim() : '',
        'Cancelled (Lat/Lng)': hist['Cancelled'] ? `${hist['Cancelled'].lat}, ${hist['Cancelled'].lng}` : '',
        
        'Latest City': ticket.latest_city || '',
        'Remarks': ticket.remarks || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Productivity Dashboard");

    const wsRaw = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, wsRaw, "Complete Ticket Data");

    XLSX.writeFile(wb, `Engineer_Productivity_${reportNameSuffix}.xlsx`);
    setLoading(false);
    setIsExportModalOpen(false);
  };

  // Project Filtering
  const uniqueProjects = [...new Set(data.map(d => d.project_name).filter(Boolean))].sort();
  const projectFilteredData = projectFilter ? data.filter(d => d.project_name === projectFilter) : data;

  // KPI Calculations
  const uniqueEngineers = new Set(projectFilteredData.map(d => d.employee_id)).size;
  const totalTickets = projectFilteredData.length;
  
  const statusCounts = {
    'Assigned': projectFilteredData.filter(d => d.current_status === 'Assigned').length,
    'Start Journey': projectFilteredData.filter(d => d.current_status === 'Start Journey').length,
    'Travelling': projectFilteredData.filter(d => d.current_status === 'Travelling').length,
    'Reached the Site': projectFilteredData.filter(d => d.current_status === 'Reached the Site').length,
    'Activity Completed': projectFilteredData.filter(d => d.current_status === 'Activity Completed').length,
    'Leaving the Site': projectFilteredData.filter(d => d.current_status === 'Leaving the Site').length,
    'Attempted': projectFilteredData.filter(d => d.current_status === 'Attempted').length,
    'Cancelled': projectFilteredData.filter(d => d.current_status === 'Cancelled').length,
  };

  const travellingCount = statusCounts['Start Journey'] + statusCounts['Travelling'];
  const reachedCount = statusCounts['Reached the Site'];
  const completedCount = statusCounts['Activity Completed'] + statusCounts['Leaving the Site'];

  const filteredData = projectFilteredData.filter(d => 
    ((d.engineer_name?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (d.ticket_id?.toLowerCase().includes(searchQuery.toLowerCase()))) &&
    (statusFilter ? d.current_status === statusFilter : true)
  );

  // Map Data Conversion
  const mapData = filteredData.map(ticket => ({
    id: ticket.id,
    latitude: ticket.latest_lat,
    longitude: ticket.latest_lng,
    engineer: ticket.engineer_name,
    employeeId: ticket.employee_id,
    status: ticket.current_status,
    ticketId: ticket.ticket_id,
    city: ticket.latest_city,
    time: ticket.status_history && ticket.status_history[ticket.current_status] 
          ? ticket.status_history[ticket.current_status].time 
          : ''
  }));

  const allEngineersMapData = allEngineersData
    .filter(d => !projectFilter || d.project_name === projectFilter)
    .map(ticket => ({
      id: ticket.id,
      latitude: ticket.latest_lat,
    longitude: ticket.latest_lng,
    engineer: ticket.engineer_name,
    employeeId: ticket.employee_id,
    status: ticket.current_status,
    ticketId: ticket.ticket_id,
    city: ticket.latest_city,
    time: ticket.status_history && ticket.status_history[ticket.current_status] 
          ? ticket.status_history[ticket.current_status].time 
          : ''
  }));

  const getStatModalData = () => {
    if (!statModalConfig.isOpen) return [];
    switch (statModalConfig.type) {
      case 'active': {
        const seen = new Set();
        const result = [];
        projectFilteredData.forEach(t => {
          if (!seen.has(t.employee_id)) {
            seen.add(t.employee_id);
            result.push(t);
          }
        });
        return result;
      }
      case 'total':
        return projectFilteredData;
      case 'travelling':
        return projectFilteredData.filter(d => d.current_status === 'Start Journey' || d.current_status === 'Travelling');
      case 'reached':
        return projectFilteredData.filter(d => d.current_status === 'Reached the Site');
      case 'completed':
        return projectFilteredData.filter(d => d.current_status === 'Activity Completed' || d.current_status === 'Leaving the Site');
      default:
        return [];
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'Loki@1312') {
      sessionStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Incorrect password. Access denied.');
      setPasswordInput('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 rounded-2xl shadow-xl w-full max-w-sm animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-indigo-100 blur-2xl z-0"></div>
          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
              <p className="text-sm text-gray-500 mt-1">Enter password to access dashboard</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="form-group">
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password" 
                  className="input-field py-3 text-center tracking-widest text-lg"
                  autoFocus
                />
              </div>
              {authError && <p className="text-red-500 text-sm text-center font-medium">{authError}</p>}
              <button type="submit" className="btn-primary w-full py-3 rounded-xl font-bold">
                Login
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1 mx-auto">
                <ArrowLeft size={14} /> Back to Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Back to Portal">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight hidden sm:block">Admin Dashboard</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const newMode = !showAllEngineersMode;
              setShowAllEngineersMode(newMode);
              if (newMode) fetchAllEngineersData();
            }}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${showAllEngineersMode ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
          >
            All Engineer Live Data
          </button>
          
          {filterDate === new Date().toISOString().split('T')[0] && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[10px] font-bold uppercase tracking-wider">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
              Live Tracking
            </div>
          )}
          
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-200 focus:border-primary outline-none transition-all hidden md:block max-w-[150px] lg:max-w-[200px] truncate bg-gray-50 text-gray-700"
          >
            <option value="">All Projects</option>
            {uniqueProjects.map(proj => (
              <option key={proj} value={proj}>{proj}</option>
            ))}
          </select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-primary outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => fetchData(false)} 
            title="Refresh Live Data"
            className="p-2 bg-indigo-50 text-primary hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={() => setIsExportModalOpen(true)} 
            title="Export Productivity Data"
            disabled={loading}
            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            <span className="hidden lg:inline text-sm font-semibold">Export</span>
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
          
          <button 
            onClick={() => {
              sessionStorage.removeItem('admin_auth');
              setIsAuthenticated(false);
            }} 
            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            title="Logout"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline text-sm font-semibold">Logout</span>
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div 
            onClick={() => setStatModalConfig({ isOpen: true, title: 'Active Engineers', type: 'active' })}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-purple-200 transition-all"
          >
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center"><Users size={20} /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Engineers</p>
              <h3 className="text-xl font-bold text-gray-800">{uniqueEngineers}</h3>
            </div>
          </div>

          <div 
            onClick={() => setStatModalConfig({ isOpen: true, title: 'Total Tickets', type: 'total' })}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Briefcase size={20} /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Tickets</p>
              <h3 className="text-xl font-bold text-gray-800">{totalTickets}</h3>
            </div>
          </div>
          
          <div 
            onClick={() => setStatModalConfig({ isOpen: true, title: 'Travelling', type: 'travelling' })}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all"
          >
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center"><Truck size={20} /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Travelling</p>
              <h3 className="text-xl font-bold text-gray-800">{travellingCount}</h3>
            </div>
          </div>

          <div 
            onClick={() => setStatModalConfig({ isOpen: true, title: 'Reached Site', type: 'reached' })}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all"
          >
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><MapPin size={20} /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Reached Site</p>
              <h3 className="text-xl font-bold text-gray-800">{reachedCount}</h3>
            </div>
          </div>

          <div 
            onClick={() => setStatModalConfig({ isOpen: true, title: 'Completed Tickets', type: 'completed' })}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all"
          >
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><CheckCircle2 size={20} /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Completed</p>
              <h3 className="text-xl font-bold text-gray-800">{completedCount}</h3>
            </div>
          </div>
        </div>

        {/* Status Breakdown Pills */}
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries({
            'Assigned': { bg: 'bg-gray-100 text-gray-700 hover:bg-gray-200', active: 'ring-2 ring-gray-400 bg-gray-200 shadow-md scale-105' },
            'Start Journey': { bg: 'bg-amber-50 text-amber-700 hover:bg-amber-100', active: 'ring-2 ring-amber-400 bg-amber-100 shadow-md scale-105' },
            'Travelling': { bg: 'bg-amber-100 text-amber-800 hover:bg-amber-200', active: 'ring-2 ring-amber-500 bg-amber-200 shadow-md scale-105' },
            'Reached the Site': { bg: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100', active: 'ring-2 ring-indigo-400 bg-indigo-100 shadow-md scale-105' },
            'Attempted': { bg: 'bg-blue-50 text-blue-700 hover:bg-blue-100', active: 'ring-2 ring-blue-400 bg-blue-100 shadow-md scale-105' },
            'Activity Completed': { bg: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', active: 'ring-2 ring-emerald-400 bg-emerald-100 shadow-md scale-105' },
            'Leaving the Site': { bg: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200', active: 'ring-2 ring-emerald-500 bg-emerald-200 shadow-md scale-105' },
            'Cancelled': { bg: 'bg-red-50 text-red-700 hover:bg-red-100', active: 'ring-2 ring-red-400 bg-red-100 shadow-md scale-105' }
          }).map(([statusName, styles]) => (
            <button 
              key={statusName}
              onClick={() => setStatusFilter(statusFilter === statusName ? null : statusName)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${styles.bg} ${statusFilter === statusName ? styles.active : statusFilter ? 'opacity-50 hover:opacity-100' : ''}`}
            >
              {statusName} <span className="bg-white px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm">{statusCounts[statusName]}</span>
            </button>
          ))}
          {statusFilter && (
            <button 
              onClick={() => setStatusFilter(null)}
              className="px-2.5 py-1 bg-gray-800 text-white hover:bg-gray-900 rounded-md text-[11px] font-medium transition-all shadow-sm flex items-center gap-1"
            >
              <X size={12} /> Clear Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Data Table */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="font-bold text-gray-800">Tickets Directory</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search Tickets..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-primary w-40"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {loading ? (
                <div className="flex justify-center items-center h-full text-gray-400">Loading data...</div>
              ) : filteredData.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400 text-sm">No tickets found.</div>
              ) : (
                <div className="space-y-2">
                  {filteredData.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-2 rounded-lg border transition-colors group cursor-pointer
                        ${selectedTicket?.id === ticket.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-semibold text-gray-800 text-xs group-hover:text-primary transition-colors">{ticket.ticket_id}</div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide
                          ${['Activity Completed', 'Leaving the Site'].includes(ticket.current_status) ? 'bg-emerald-100 text-emerald-700' : 
                            ['Start Journey', 'Travelling', 'Attempted'].includes(ticket.current_status) ? 'bg-amber-100 text-amber-700' : 
                            ticket.current_status === 'Cancelled' ? 'bg-red-100 text-red-700' : 
                            ticket.current_status === 'Reached the Site' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                          {ticket.current_status}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 flex justify-between items-center">
                        <span>{ticket.engineer_name} (ID: {ticket.employee_id})</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 truncate flex items-center gap-1">
                        <MapPin size={9} /> {ticket.latest_city || 'Unknown Location'}
                      </div>
                      {ticket.remarks && (
                        <div className="text-[10px] text-gray-500 mt-1.5 bg-gray-50 border border-gray-100 p-1.5 rounded-md flex items-start gap-1">
                          <MessageSquare size={10} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="italic line-clamp-2">{ticket.remarks}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Chronology Box */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in relative h-[500px] flex flex-col">
                <button 
                  onClick={() => setSelectedTicket(null)} 
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
                >
                  <X size={18} />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Activity size={20} />
                  </div>
                  <div className="flex-1 flex justify-between items-start pr-8">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Activity Timeline: {selectedTicket.ticket_id}</h3>
                      <p className="text-sm text-gray-500">Engineer: {selectedTicket.engineer_name} ({selectedTicket.employee_id})</p>
                    </div>
                    <div className="text-right bg-indigo-50/50 p-2 rounded-lg border border-indigo-50 hidden sm:block">
                      <p className="text-xs font-bold text-indigo-800 flex items-center justify-end gap-1 mb-0.5"><MapPin size={12}/> Current Location</p>
                      <p className="text-[10px] text-indigo-600 font-mono">{selectedTicket.latest_lat}, {selectedTicket.latest_lng}</p>
                      <p className="text-[10px] text-indigo-400">{selectedTicket.latest_city}</p>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto flex-1">
                  <div className="flex gap-4 min-w-max px-2 py-2">
                    {Object.entries(selectedTicket.status_history || {})
                      .sort((a, b) => {
                        if (!a[1].time) return -1;
                        if (!b[1].time) return 1;
                        const dateA = a[1].date || '1970/01/01';
                        const dateB = b[1].date || '1970/01/01';
                        return new Date(`${dateA} ${a[1].time}`) - new Date(`${dateB} ${b[1].time}`);
                      })
                      .map(([statusName, details], index) => (
                      <div key={statusName} className="relative flex flex-col items-center w-40 flex-shrink-0">
                        <div className="w-full flex items-center justify-center mb-2 relative">
                          <div className="absolute w-full h-0.5 bg-indigo-100 top-1/2 -translate-y-1/2 left-1/2"></div>
                          <div className="w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm relative z-10"></div>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 w-full text-center hover:shadow-md transition-shadow">
                          <p className="text-xs font-bold text-gray-700 mb-1">{statusName}</p>
                          <div className="text-[10px] text-gray-500 flex flex-col items-center justify-center gap-0.5 mb-1">
                            <span className="flex items-center gap-1"><Clock size={10} /> {details.time || 'N/A'}</span>
                            {details.date && <span className="text-[9px] font-mono text-gray-400 bg-white px-1 py-0.5 rounded border border-gray-100">{details.date}</span>}
                          </div>
                          {details.lat && details.lng && (
                            <p className="text-[9px] text-gray-400 flex flex-col items-center justify-center font-mono bg-white rounded border border-gray-100 p-1 mt-1">
                              <span className="flex items-center gap-1 text-indigo-400 mb-0.5"><MapPin size={8} /> GPS Logged</span>
                              {parseFloat(details.lat).toFixed(5)}, {parseFloat(details.lng).toFixed(5)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {Object.keys(selectedTicket.status_history || {}).length === 0 && (
                      <div className="text-sm text-gray-400 italic mt-8">No activity recorded yet for this ticket.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center h-[500px] text-gray-400">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Activity size={28} className="text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">Select a ticket to view timeline</p>
                <p className="text-sm mt-1">Click on any ticket in the directory to see activity logs</p>
              </div>
            )}
          </div>

        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative h-[500px] p-2">
          {loading ? (
            <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center rounded-xl">
              <div className="spinner border-gray-400 border-t-gray-800"></div>
            </div>
          ) : (
            <MapComponent data={showAllEngineersMode ? allEngineersMapData : mapData} isDiamondMode={showAllEngineersMode} />
          )}
        </div>

      </div>

      {/* Stats Details Modal */}
      {statModalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] max-h-[600px] animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">{statModalConfig.title} ({getStatModalData().length})</h3>
              <button onClick={() => setStatModalConfig({ isOpen: false, title: '', type: '' })} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-4 bg-gray-50/30">
              {getStatModalData().length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400">No records found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getStatModalData().map((item) => (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-gray-800">{item.engineer_name}</p>
                          <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1 mt-0.5"><Briefcase size={10} /> ID: {item.employee_id}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider
                          ${['Activity Completed', 'Leaving the Site'].includes(item.current_status) ? 'bg-emerald-100 text-emerald-700' : 
                            ['Start Journey', 'Travelling', 'Attempted'].includes(item.current_status) ? 'bg-amber-100 text-amber-700' : 
                            item.current_status === 'Cancelled' ? 'bg-red-100 text-red-700' : 
                            item.current_status === 'Reached the Site' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                          {item.current_status}
                        </span>
                      </div>
                      
                      {statModalConfig.type !== 'active' && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <span className="font-semibold text-gray-700">Ticket:</span> {item.ticket_id}
                        </div>
                      )}
                      
                      {item.latest_city && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <MapPin size={10} /> {item.latest_city}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Download size={18} className="text-emerald-600"/> Export Data</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${exportType === 'month' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setExportType('month')}
                >
                  By Month
                </button>
                <button 
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${exportType === 'dateRange' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setExportType('dateRange')}
                >
                  By Date Range
                </button>
              </div>

              {exportType === 'month' ? (
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                    <input 
                      type="month" 
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                      <input 
                        type="date" 
                        value={exportFromDate}
                        onChange={(e) => setExportFromDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                    <div className="form-group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                      <input 
                        type="date" 
                        value={exportToDate}
                        onChange={(e) => setExportToDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group border-t border-gray-100 pt-4 mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Engineer (Optional)</label>
                <input 
                  type="text" 
                  value={exportEngineerId}
                  onChange={(e) => setExportEngineerId(e.target.value)}
                  placeholder="Enter Employee ID (Leave blank for all)"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
              
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Project (Optional)</label>
                <input 
                  type="text" 
                  value={exportProjectName}
                  onChange={(e) => setExportProjectName(e.target.value)}
                  placeholder="Enter Project Name (Leave blank for all)"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <button 
                onClick={downloadProductivity}
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                Download Excel Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
