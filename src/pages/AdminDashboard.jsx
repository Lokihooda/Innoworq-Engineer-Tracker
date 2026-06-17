import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import MapComponent from '../components/MapComponent';
import * as XLSX from 'xlsx';
import { Users, Truck, CheckCircle2, MapPin, Search, RefreshCw, Calendar, ArrowLeft, Download, Briefcase, MessageSquare } from 'lucide-react';
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

  const fetchData = async () => {
    setLoading(true);
    const { data: ticketData, error } = await supabase
      .from('ticket_tracking')
      .select('*')
      .eq('date', filterDate)
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
    } else {
      setData(ticketData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  const downloadProductivity = async () => {
    setLoading(true);
    const yearMonth = filterDate.substring(0, 7); // YYYY-MM
    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(year, month, 0).getDate();
    
    const { data: monthData, error } = await supabase
      .from('ticket_tracking')
      .select('*')
      .gte('date', `${yearMonth}-01`)
      .lte('date', `${yearMonth}-${lastDay}`);

    if (error) {
      console.error('Error fetching monthly data:', error);
      alert('Failed to fetch data for report.');
      setLoading(false);
      return;
    }

    const engineerStats = {};
    
    (monthData || []).forEach(ticket => {
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
    const rawData = (monthData || []).map(ticket => {
      const hist = ticket.status_history || {};
      return {
        'Date': ticket.date,
        'Ticket ID': ticket.ticket_id,
        'Engineer ID': ticket.employee_id,
        'Engineer Name': ticket.engineer_name,
        'Current Status': ticket.current_status,
        
        'Assigned (Time)': hist['Assigned']?.time || '',
        'Assigned (Lat/Lng)': hist['Assigned'] ? `${hist['Assigned'].lat}, ${hist['Assigned'].lng}` : '',
        
        'Start Journey (Time)': hist['Start Journey']?.time || '',
        'Start Journey (Lat/Lng)': hist['Start Journey'] ? `${hist['Start Journey'].lat}, ${hist['Start Journey'].lng}` : '',
        
        'Travelling (Time)': hist['Travelling']?.time || '',
        'Travelling (Lat/Lng)': hist['Travelling'] ? `${hist['Travelling'].lat}, ${hist['Travelling'].lng}` : '',
        
        'Reached Site (Time)': hist['Reached the Site']?.time || '',
        'Reached Site (Lat/Lng)': hist['Reached the Site'] ? `${hist['Reached the Site'].lat}, ${hist['Reached the Site'].lng}` : '',
        
        'Activity Completed (Time)': hist['Activity Completed']?.time || '',
        'Activity Completed (Lat/Lng)': hist['Activity Completed'] ? `${hist['Activity Completed'].lat}, ${hist['Activity Completed'].lng}` : '',
        
        'Leaving Site (Time)': hist['Leaving the Site']?.time || '',
        'Leaving Site (Lat/Lng)': hist['Leaving the Site'] ? `${hist['Leaving the Site'].lat}, ${hist['Leaving the Site'].lng}` : '',
        
        'Attempted (Time)': hist['Attempted']?.time || '',
        'Attempted (Lat/Lng)': hist['Attempted'] ? `${hist['Attempted'].lat}, ${hist['Attempted'].lng}` : '',
        
        'Cancelled (Time)': hist['Cancelled']?.time || '',
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

    XLSX.writeFile(wb, `Engineer_Productivity_${yearMonth}.xlsx`);
    setLoading(false);
  };

  // KPI Calculations
  const totalTickets = data.length;
  const travellingCount = data.filter(d => d.current_status === 'Start Journey' || d.current_status === 'Travelling').length;
  const reachedCount = data.filter(d => d.current_status === 'Reached the Site').length;
  const completedCount = data.filter(d => d.current_status === 'Activity Completed' || d.current_status === 'Leaving the Site').length;

  const filteredData = data.filter(d => 
    (d.engineer_name?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (d.ticket_id?.toLowerCase().includes(searchQuery.toLowerCase()))
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
    city: ticket.latest_city
  }));

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
          <button onClick={() => navigate('/')} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Admin Dashboard</h1>
        </div>
        
        <div className="flex items-center gap-4">
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
            onClick={fetchData} 
            title="Refresh Live Data"
            className="p-2 bg-indigo-50 text-primary hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={downloadProductivity} 
            title="Export Monthly Productivity (Excel)"
            disabled={loading}
            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            <span className="hidden sm:inline text-sm font-semibold">Export Month</span>
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Briefcase size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Tickets</p>
              <h3 className="text-2xl font-bold text-gray-800">{totalTickets}</h3>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><Truck size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Travelling</p>
              <h3 className="text-2xl font-bold text-gray-800">{travellingCount}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><MapPin size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Reached Site</p>
              <h3 className="text-2xl font-bold text-gray-800">{reachedCount}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle2 size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Completed</p>
              <h3 className="text-2xl font-bold text-gray-800">{completedCount}</h3>
            </div>
          </div>
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
                    <div key={ticket.id} className="p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-colors group cursor-pointer">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-semibold text-gray-800 text-sm group-hover:text-primary transition-colors">{ticket.ticket_id}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
                          ${['Activity Completed', 'Leaving the Site'].includes(ticket.current_status) ? 'bg-emerald-100 text-emerald-700' : 
                            ['Start Journey', 'Travelling', 'Attempted'].includes(ticket.current_status) ? 'bg-amber-100 text-amber-700' : 
                            ticket.current_status === 'Cancelled' ? 'bg-red-100 text-red-700' : 
                            ticket.current_status === 'Reached the Site' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                          {ticket.current_status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between items-center">
                        <span>{ticket.engineer_name} (ID: {ticket.employee_id})</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate flex items-center gap-1">
                        <MapPin size={10} /> {ticket.latest_city || 'Unknown Location'}
                      </div>
                      {ticket.remarks && (
                        <div className="text-xs text-gray-500 mt-2 bg-gray-50 border border-gray-100 p-2 rounded-lg flex items-start gap-1.5">
                          <MessageSquare size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="italic line-clamp-2">{ticket.remarks}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="h-[500px] w-full rounded-2xl border border-gray-200 bg-gray-100 animate-pulse flex items-center justify-center">
                <div className="spinner border-gray-400 border-t-gray-800"></div>
              </div>
            ) : (
              <MapComponent data={mapData} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
