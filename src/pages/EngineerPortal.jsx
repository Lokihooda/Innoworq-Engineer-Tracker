import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { MapPin, User, Hash, Ticket, Briefcase, MessageSquare, Send, ShieldCheck, ChevronRight, Search, Download, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function EngineerPortal() {
  const navigate = useNavigate();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finding, setFinding] = useState(false);
  
  const [location, setLocation] = useState(null);
  const [city, setCity] = useState('');
  const [message, setMessage] = useState(null);

  const [activeTicket, setActiveTicket] = useState(null); // The loaded ticket from DB
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fetchedData, setFetchedData] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    ticketId: '',
    status: '',
    remarks: ''
  });

  useEffect(() => {
    // Check if engineer details are saved
    const savedName = localStorage.getItem('eng_name');
    const savedEmpId = localStorage.getItem('eng_empId');
    if (savedName && savedEmpId) {
      setFormData(prev => ({ ...prev, name: savedName, employeeId: savedEmpId }));
    }
    
    // Ensure device ID exists
    if (!localStorage.getItem('eng_deviceId')) {
      localStorage.setItem('eng_deviceId', 'DEV-' + Math.random().toString(36).substring(2, 10));
    }
  }, []);

  // Background Location Tracking
  useEffect(() => {
    let watchId;
    let lastUpdateTime = 0;

    const startTracking = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const trackingTicketId = localStorage.getItem('tracking_ticket_id');
            if (!trackingTicketId) return;

            const now = Date.now();
            // Throttle updates to every 30 seconds
            if (now - lastUpdateTime < 30000) return;
            lastUpdateTime = now;

            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            try {
              await supabase.from('ticket_tracking')
                .update({
                  latest_lat: lat,
                  latest_lng: lng,
                })
                .eq('id', trackingTicketId);
            } catch (err) {
              console.error("Failed to update background location", err);
            }
          },
          (err) => {
            console.error('Background tracking error:', err);
          },
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      }
    };

    startTracking();

    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const requestGPS = () => {
    setGpsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            setCity(data.address.city || data.address.town || data.address.county || "Unknown Location");
          } catch (e) {
            setCity("Unknown Location");
          }
          setGpsLoading(false);
        },
        (err) => {
          console.error(err);
          setMessage({ type: 'error', text: 'Location access denied. Please enable GPS to proceed.' });
          setGpsLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      setGpsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const findTicket = async () => {
    if (!formData.ticketId) {
      setMessage({ type: 'error', text: 'Please enter a Ticket ID to search.' });
      return;
    }
    
    setFinding(true);
    setMessage(null);
    const today = new Date().toISOString().split('T')[0];

    const { data: ticketData, error } = await supabase
      .from('ticket_tracking')
      .select('*')
      .eq('ticket_id', formData.ticketId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      setMessage({ type: 'error', text: 'Error finding ticket.' });
    } else if (ticketData) {
      const deviceId = localStorage.getItem('eng_deviceId');
      if (ticketData.device_id !== deviceId) {
        setMessage({ type: 'error', text: 'Access Denied: This ticket was started on a different device.' });
      } else {
        setActiveTicket(ticketData);
        setMessage({ type: 'success', text: `Found ticket! Current Status: ${ticketData.current_status}` });
        setFormData(prev => ({ 
          ...prev, 
          status: ticketData.current_status || '', 
          name: ticketData.engineer_name || prev.name, 
          employeeId: ticketData.employee_id || prev.employeeId,
          remarks: ticketData.remarks || ''
        }));
      }
    } else {
      setActiveTicket({ isNew: true });
      setMessage({ type: 'success', text: 'No existing record found for today. You can start this ticket.' });
    }
    setFinding(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) {
      setMessage({ type: 'error', text: 'Please enable GPS location first.' });
      return;
    }
    if (!activeTicket) {
      setMessage({ type: 'error', text: 'Please search for a ticket first.' });
      return;
    }

    setSubmitting(true);
    const deviceId = localStorage.getItem('eng_deviceId');
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString();

    // The status payload to append to history
    const statusUpdatePayload = {
      time: currentTime,
      lat: location.lat,
      lng: location.lng,
      city: city
    };

    if (activeTicket.isNew) {
      // Create new ticket row
      const newHistory = { [formData.status]: statusUpdatePayload };
      
      const { data, error } = await supabase.from('ticket_tracking').insert([{
        ticket_id: formData.ticketId,
        date: today,
        employee_id: formData.employeeId,
        engineer_name: formData.name,
        device_id: deviceId,
        current_status: formData.status,
        latest_city: city,
        latest_lat: location.lat,
        latest_lng: location.lng,
        status_history: newHistory,
        remarks: formData.remarks
      }]).select();

      if (error) {
        console.error(error);
        setMessage({ type: 'error', text: `Failed to create ticket: ${error.message}` });
      } else {
        handleSuccess('Ticket started successfully!', formData.status, data[0].id);
      }
    } else {
      // Update existing ticket row
      const updatedHistory = { 
        ...activeTicket.status_history, 
        [formData.status]: statusUpdatePayload 
      };

      const { error } = await supabase.from('ticket_tracking')
        .update({
          current_status: formData.status,
          latest_city: city,
          latest_lat: location.lat,
          latest_lng: location.lng,
          status_history: updatedHistory,
          remarks: formData.remarks || activeTicket.remarks
        })
        .eq('id', activeTicket.id);

      if (error) {
        console.error(error);
        setMessage({ type: 'error', text: `Failed to update ticket: ${error.message}` });
      } else {
        handleSuccess('Ticket status updated successfully!', formData.status, activeTicket.id);
      }
    }
    setSubmitting(false);
  };

  const handleSuccess = (msg, status, ticketDbId) => {
    localStorage.setItem('eng_name', formData.name);
    localStorage.setItem('eng_empId', formData.employeeId);
    
    if (status === 'Start Journey' || status === 'Travelling') {
      localStorage.setItem('tracking_ticket_id', ticketDbId);
    } else if (['Reached the Site', 'Activity Completed', 'Leaving the Site', 'Attempted', 'Cancelled'].includes(status)) {
      localStorage.removeItem('tracking_ticket_id');
    }

    setMessage({ type: 'success', text: msg });
    setActiveTicket(null);
    setFormData(prev => ({ ...prev, ticketId: '', status: '', remarks: '' }));
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchMyData = async () => {
    if (!formData.employeeId) {
      setMessage({ type: 'error', text: 'Please enter an Employee ID to view data.' });
      return;
    }
    
    setIsFetchingData(true);
    setFetchedData(null);
    
    const { data: reportData, error } = await supabase
      .from('ticket_tracking')
      .select('*')
      .ilike('employee_id', formData.employeeId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to fetch data for report.' });
      setIsFetchingData(false);
      return;
    }

    if (!reportData || reportData.length === 0) {
      setMessage({ type: 'error', text: 'No data found for this period.' });
      setIsFetchingData(false);
      return;
    }

    setFetchedData(reportData);
    setIsFetchingData(false);
    setMessage({ type: 'success', text: `Found ${reportData.length} records.` });
    setTimeout(() => setMessage(null), 3000);
  };

  const downloadExcel = () => {
    if (!fetchedData || fetchedData.length === 0) return;
    setIsDownloading(true);

    const rawData = fetchedData.map(ticket => {
      const hist = ticket.status_history || {};
      return {
        'Date': ticket.date,
        'Ticket ID': ticket.ticket_id,
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
    const wsRaw = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, wsRaw, "My Tickets");

    XLSX.writeFile(wb, `My_Productivity_${formData.employeeId}_${fromDate}_to_${toDate}.xlsx`);
    setIsDownloading(false);
    setMessage({ type: 'success', text: 'Data downloaded successfully!' });
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="container p-4 mx-auto max-w-md min-h-screen flex flex-col justify-center py-10">
      
      {/* Header */}
      <header className="glass-card mb-8 p-6 text-center rounded-2xl">
        <h1 className="text-3xl font-bold text-gradient mb-2">Innoworq</h1>
        <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Field Service Portal</p>
      </header>

      <div className="glass-card p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-indigo-100 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 rounded-full bg-secondary/10 blur-2xl"></div>

        <div className="relative z-10">
          {!location ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-6 animate-pulse-slow">
                <MapPin size={36} className="text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Location Required</h2>
              <p className="text-gray-600 mb-8 text-sm leading-relaxed">
                We need your GPS coordinates to verify your site visit. Please enable location services.
              </p>
              <button 
                onClick={requestGPS} 
                disabled={gpsLoading}
                className="btn-primary w-full py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                {gpsLoading ? <div className="spinner"></div> : <><MapPin size={20} /> Enable GPS to Continue</>}
              </button>
            </div>
          ) : (
            <div className="space-y-5 animate-fade-in">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping-slow"></div>
                  GPS Active
                </div>
                <div className="text-xs text-gray-500 truncate max-w-[150px]">{city}</div>
              </div>

              {/* Search Box Ticket ID */}
              <div className="form-group mb-6">
                <label className="text-sm font-semibold text-gray-700 mb-1 block"><Ticket size={16} className="inline mr-1" /> Search Ticket ID</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    name="ticketId" 
                    value={formData.ticketId} 
                    onChange={(e) => {
                      handleInputChange(e);
                      if (activeTicket) setActiveTicket(null); // Reset active ticket if they start typing a new one
                    }} 
                    placeholder="Enter Ticket ID..." 
                    className="input-field flex-1 text-lg py-3" 
                  />
                  <button type="button" onClick={findTicket} disabled={finding || !formData.ticketId} className="btn-primary px-6 rounded-xl flex items-center justify-center shadow-md">
                    {finding ? <div className="spinner w-5 h-5 border-2"></div> : <Search size={22} />}
                  </button>
                </div>
              </div>

              {/* Status Update Box (Opens when ticket is searched) */}
              {activeTicket && (
                <form onSubmit={handleSubmit} className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 animate-slide-up space-y-4 relative z-20">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <Briefcase size={18} className="text-primary" />
                      Status Update
                    </h3>
                    {!activeTicket.isNew && (
                      <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                        {activeTicket.current_status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="text-xs text-gray-500 font-semibold uppercase">Engineer Name</label>
                      <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="John Doe" className="input-field py-2 text-sm" />
                    </div>
                    <div className="form-group">
                      <label className="text-xs text-gray-500 font-semibold uppercase">Employee ID</label>
                      <input type="text" name="employeeId" value={formData.employeeId} onChange={handleInputChange} required placeholder="EMP123" className="input-field py-2 text-sm" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="text-xs text-gray-500 font-semibold uppercase">Ticket ID</label>
                    <input type="text" value={formData.ticketId} readOnly className="input-field py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed font-medium" />
                  </div>
                  
                  <div className="form-group">
                    <label className="text-xs text-gray-500 font-semibold uppercase">New Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} required className="input-field py-2.5">
                      <option value="" disabled>Select Status</option>
                      <option value="Assigned">🔵 Assigned</option>
                      <option value="Start Journey">🟠 Start Journey</option>
                      <option value="Travelling">🟠 Travelling</option>
                      <option value="Reached the Site">🟢 Reached the Site</option>
                      <option value="Activity Completed">🟢 Activity Completed</option>
                      <option value="Leaving the Site">🔵 Leaving the Site</option>
                      <option value="Attempted">🟠 Attempted</option>
                      <option value="Cancelled">🔴 Cancelled</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="text-xs text-gray-500 font-semibold uppercase">Remark</label>
                    <input type="text" name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="Any notes..." className="input-field py-2.5" />
                  </div>

                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="btn-primary w-full py-3.5 mt-2 rounded-xl text-md font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {submitting ? <div className="spinner"></div> : <><Send size={18} /> Submit Update</>}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Download Data Section */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search size={16} className="text-primary" /> View & Download Report
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">Employee ID</label>
                  <input 
                    type="text" 
                    name="employeeId" 
                    value={formData.employeeId} 
                    onChange={handleInputChange} 
                    placeholder="EMP123" 
                    className="input-field w-full py-2 text-sm" 
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">From Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="date" 
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="input-field w-full py-2 pl-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">To Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="date" 
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="input-field w-full py-2 pl-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={fetchMyData} 
                disabled={isFetchingData || !formData.employeeId || !fromDate || !toDate} 
                className="btn-primary w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {isFetchingData ? <div className="spinner w-4 h-4 border-2"></div> : <><Search size={16} /> Fetch Data</>}
              </button>
            </div>

            {fetchedData && fetchedData.length > 0 && (
              <div className="mt-6 animate-slide-up">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Records Found: {fetchedData.length}</h4>
                  <button 
                    type="button" 
                    onClick={downloadExcel} 
                    disabled={isDownloading} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm transition-colors"
                  >
                    {isDownloading ? <div className="spinner w-3 h-3 border-2"></div> : <><Download size={14} /> Download Excel</>}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 shadow-inner p-2 space-y-2 custom-scrollbar">
                  {fetchedData.map((ticket, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-800 text-sm">{ticket.ticket_id}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                          {ticket.current_status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>{ticket.date}</span>
                        <span>{ticket.latest_city || "Unknown Location"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {message && (
            <div className={`mt-6 p-4 rounded-xl text-center text-sm font-medium animate-slide-up ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <button 
          onClick={() => navigate('/admin')} 
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ShieldCheck size={16} />
          Admin Access
          <ChevronRight size={16} />
        </button>
      </div>

    </div>
  );
}
