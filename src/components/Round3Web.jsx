import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Container,
  Chip
} from '@mui/material';
import axios from 'axios';
import Navbar from './Navbar';
import { webChallenges } from '../data/webChallenges';

// Function to submit challenge (real implementation)
const submitChallenge = async (challengeId, html, css, js, isAutoSubmission = false) => {
  try {
    // Find the challenge by ID to get its name safely
    const challenge = webChallenges.find(c => c.id === challengeId) || webChallenges[0];
    
    const response = await axios.post('/api/round3/submit-web', {
      user_id: JSON.parse(localStorage.getItem('user')).id,
      challenge_id: challengeId,
      challenge_name: challenge.title,
      html_code: html,
      css_code: css,
      js_code: js,
      is_auto_submission: isAutoSubmission
    });
    
    return {
      success: response.data.success,
      message: "Solution submitted successfully! It will be reviewed by an admin.",
      score: response.data.score,
      qualified_for_next: response.data.qualified_for_next
    };
  } catch (error) {
    console.error('Error submitting web challenge:', error);
    
    // Check if the error is due to round not being enabled
    if (error.response?.data?.round_not_enabled) {
      return {
        success: false,
        message: "Round 3 is currently not enabled by the administrator.",
        round_not_enabled: true
      };
    }
    
    return {
      success: false,
      message: error.response?.data?.error || "Error submitting challenge. Please try again."
    };
  }
};

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      style={{ height: '100%' }}
    >
      {value === index && (
        <Box sx={{ height: '100%', pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Round3Web = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentChallenge, setCurrentChallenge] = useState(0);
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [jsCode, setJsCode] = useState('');
  const [editorTab, setEditorTab] = useState(0);
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [completedChallenges, setCompletedChallenges] = useState([]);
  const [roundEnabled, setRoundEnabled] = useState(false);
  const [waitingForAccess, setWaitingForAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [isAccessDisabledAlert, setIsAccessDisabledAlert] = useState(false);

  // Function to check if Round 3 is enabled
  const checkRoundAccess = async () => {
    try {
      const response = await axios.get('/api/rounds/access');
      if (response.data && response.data.round3) {
        setRoundEnabled(response.data.round3.enabled);
        return response.data.round3.enabled;
      }
      return false;
    } catch (error) {
      console.error('Error checking round access:', error);
      return false;
    }
  };

  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (!loggedInUser) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(loggedInUser);
    // Check if user has access to Round 3
    if (parsedUser.current_round < 3) {
      navigate('/participant-dashboard');
      return;
    }
    
    // Check if user has selected the Web track
    if (parsedUser.round3_track !== 'web') {
      // If they haven't selected a track yet, send them to selection page
      if (!parsedUser.round3_track) {
        navigate('/round3');
        return;
      }
      
      // If they've selected DSA track, show error and redirect
      setSnackbar({
        open: true,
        message: 'You have selected the DSA track and cannot access Web Development challenges.',
        severity: 'error'
      });
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/round3');
      }, 3000);
      return;
    }

    setCurrentUser(parsedUser);
    
    // Check if Round 3 is enabled
    const checkAccess = async () => {
      const isEnabled = await checkRoundAccess();
      
      if (!isEnabled && !parsedUser.is_admin) {
        setWaitingForAccess(true);
        setSnackbar({
          open: true,
          message: 'Round 3 is not yet enabled by the administrator. Please wait for access.',
          severity: 'warning'
        });
        setLoading(false);
      } else {
        // Round is enabled or user is admin
        // Check for completed challenges
        const checkCompletedChallenges = async () => {
          try {
            const userId = JSON.parse(localStorage.getItem('user')).id;
            const response = await axios.get(`/api/round3/submissions?user_id=${userId}&track_type=web`);
            if (response.data && response.data.submissions) {
              const completed = response.data.submissions.map(sub => parseInt(sub.challenge_id));
              setCompletedChallenges(completed);
              
              // Check if all challenges are completed
              if (completed.length === webChallenges.length && completed.length > 0) {
                setOpenDialog(true);
              } else if (completed.length > 0) {
                // Find the first uncompleted challenge
                for (let i = 0; i < webChallenges.length; i++) {
                  if (!completed.includes(webChallenges[i].id)) {
                    selectChallenge(i);
                    break;
                  }
                }
              } else {
                selectChallenge(0);
              }
            } else {
              selectChallenge(0);
            }
          } catch (error) {
            console.error('Error fetching completed challenges:', error);
            selectChallenge(0);
          }
        };
        
        checkCompletedChallenges();
        setLoading(false);
      }
    };
    
    checkAccess();
  }, [navigate]);

  // Polling for round access when waiting
  useEffect(() => {
    let intervalId;
    
    if (waitingForAccess) {
      intervalId = setInterval(async () => {
        const isEnabled = await checkRoundAccess();
        if (isEnabled) {
          setWaitingForAccess(false);
          setRoundEnabled(true);
          
          // Load challenges once access is granted
          try {
            const userId = JSON.parse(localStorage.getItem('user')).id;
            const response = await axios.get(`/api/round3/submissions?user_id=${userId}&track_type=web`);
            if (response.data && response.data.submissions) {
              const completed = response.data.submissions.map(sub => parseInt(sub.challenge_id));
              setCompletedChallenges(completed);
              
              if (completed.length === webChallenges.length && completed.length > 0) {
                setOpenDialog(true);
              } else if (completed.length > 0) {
                // Find the first uncompleted challenge
                for (let i = 0; i < webChallenges.length; i++) {
                  if (!completed.includes(webChallenges[i].id)) {
                    selectChallenge(i);
                    break;
                  }
                }
              } else {
                selectChallenge(0);
              }
            } else {
              selectChallenge(0);
            }
          } catch (error) {
            console.error('Error fetching completed challenges:', error);
            selectChallenge(0);
          }
          
          setSnackbar({
            open: true,
            message: 'Round 3 access granted! You can now participate.',
            severity: 'success'
          });
        }
      }, 10000); // Check every 10 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [waitingForAccess]);

  // Enhanced access check polling - will auto-submit and redirect when access is revoked
  useEffect(() => {
    if (waitingForAccess || submitting) return;
    
    let intervalId;
    
    // Only set up polling if we're actively working on a challenge
    intervalId = setInterval(async () => {
      const isEnabled = await checkRoundAccess();
      
      if (!isEnabled && !JSON.parse(localStorage.getItem('user')).is_admin) {
        // Round access was revoked while the participant was working on a challenge
        clearInterval(intervalId);
        
        // Show notification
        setSnackbar({
          open: true,
          message: 'Round 3 access has been revoked by the administrator. Your solution will be submitted for scoring.',
          severity: 'warning'
        });
        
        // Auto-submit the current challenge with scoring
        try {
          const challenge = webChallenges[currentChallenge];
          
          // Only submit if there's substantial work (non-default content)
          if ((htmlCode && htmlCode !== challenge.htmlTemplate) || 
              (cssCode && cssCode !== challenge.cssTemplate) || 
              (jsCode && jsCode !== challenge.jsTemplate)) {
            
            console.log("Auto-submitting web challenge due to round access revocation");
            const result = await submitChallenge(
              challenge.id, 
              htmlCode, 
              cssCode, 
              jsCode, 
              true // Indicate this is an auto-submission for scoring
            );
            
            // Update completed challenges
            if (!completedChallenges.includes(challenge.id)) {
              setCompletedChallenges([...completedChallenges, challenge.id]);
            }
            
            // Show score notification if response includes score info
            if (result && result.score !== undefined) {
              setSnackbar({
                open: true,
                message: `Solution submitted and scored: ${result.score} points. ${result.qualified_for_next ? 'You have qualified for the next round!' : ''}`,
                severity: 'info'
              });
            }
          }
        } catch (error) {
          console.error("Error auto-submitting challenge:", error);
          setSnackbar({
            open: true,
            message: 'Error submitting your solution. Your progress may not be saved.',
            severity: 'error'
          });
        }
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/participant-dashboard');
        }, 3000);
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [waitingForAccess, submitting, currentChallenge, htmlCode, cssCode, jsCode, navigate, completedChallenges]);

  const handleEditorTabChange = (_, newValue) => {
    setEditorTab(newValue);
  };

  const selectChallenge = (index) => {
    setCurrentChallenge(index);
    setHtmlCode(webChallenges[index].htmlTemplate);
    setCssCode(webChallenges[index].cssTemplate);
    setJsCode(webChallenges[index].jsTemplate);
    refreshPreview();
  };

  const updatePreview = () => {
    const previewFrame = document.getElementById('preview-frame');
    if (previewFrame) {
      const preview = previewFrame.contentDocument || previewFrame.contentWindow.document;
      preview.open();
      preview.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>${cssCode}</style>
          </head>
          <body>
            ${htmlCode}
            <script>${jsCode}</script>
          </body>
        </html>
      `);
      preview.close();
    }
  };

  const refreshPreview = () => {
    setPreviewKey(Date.now()); // Force iframe refresh
    setTimeout(updatePreview, 100); // Ensure iframe has loaded before updating content
  };

  const handleSubmit = async () => {
    if (!htmlCode.trim() || !cssCode.trim()) {
      setSnackbar({
        open: true,
        message: 'HTML and CSS are required to submit.',
        severity: 'warning'
      });
      return;
    }

    setSubmitting(true);
    
    try {
      // Check if round is still enabled before submitting
      const isEnabled = await checkRoundAccess();
      if (!isEnabled && !JSON.parse(localStorage.getItem('user')).is_admin) {
        setSnackbar({
          open: true,
          message: 'Round 3 is currently disabled by the administrator. Please try again later.',
          severity: 'error'
        });
        setSubmitting(false);
        return;
      }
      
      const challenge = webChallenges[currentChallenge];
      const result = await submitChallenge(challenge.id, htmlCode, cssCode, jsCode);
      
      if (result.round_not_enabled) {
        setWaitingForAccess(true);
        setSnackbar({
          open: true,
          message: 'Round 3 has been disabled. Please wait until it is enabled again.',
          severity: 'warning'
        });
        setSubmitting(false);
        return;
      }
      
      setSnackbar({
        open: true,
        message: result.message,
        severity: result.success ? 'success' : 'error'
      });

      // Update completed challenges
      if (result.success && !completedChallenges.includes(challenge.id)) {
        setCompletedChallenges([...completedChallenges, challenge.id]);
      }
      
      // If this was the last challenge and it was successful, show completion dialog
      if (result.success && currentChallenge === webChallenges.length - 1) {
        setOpenDialog(true);
      } else if (result.success) {
        // Move to next challenge if successful
        setTimeout(() => {
          selectChallenge(currentChallenge + 1);
        }, 1500);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error submitting challenge. Please try again.',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleRunCode = () => {
    refreshPreview();
  };

  const handleSubmitChallenge = async () => {
    await handleSubmit();
  };

  // Auto-update preview on code changes with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const previewFrame = document.getElementById('preview-frame');
      if (previewFrame) {
        updatePreview();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [htmlCode, cssCode, jsCode]);

  const handleDialogClose = () => {
    setOpenDialog(false);
    navigate('/participant-dashboard');
  };

  // Start polling for round access status
  useEffect(() => {
    let intervalId;
    
    if (currentUser && !currentUser.is_admin) {
      // Set up polling
      intervalId = setInterval(async () => {
        const enabled = await checkRoundAccess();
        
        // If access status changed to disabled, show alert and prepare for redirect
        if (roundEnabled && !enabled) {
          setRoundEnabled(false);
          setIsAccessDisabledAlert(true);
          
          // After 5 seconds, redirect to dashboard
          setTimeout(() => {
            navigate('/participant-dashboard', { state: { 
              message: 'Round 3 access has been revoked by the administrator.',
              severity: 'warning'
            }});
          }, 5000);
        }
        // If access status changed to enabled
        else if (!roundEnabled && enabled) {
          setRoundEnabled(true);
          setSnackbar({
            open: true,
            message: 'Round 3 is now enabled! You can submit your solutions.',
            severity: 'success'
          });
        }
      }, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser, roundEnabled, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (waitingForAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <Navbar isAdmin={false} />
        <Paper elevation={3} sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>Waiting for Round 3 Access</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Round 3 is not yet enabled by the administrator. Please check back later.
          </Typography>
          <CircularProgress sx={{ mb: 3 }} />
          <Typography variant="body2" color="text.secondary">
            The page will automatically update when Round 3 is enabled.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/participant-dashboard')}
            sx={{ mt: 3 }}
          >
            Return to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      bgcolor: 'background.default',
      minHeight: '100vh',
      color: 'text.primary'
    }}>
      {loading && <Navbar isAdmin={false} />}
      
      <Container maxWidth="xl" sx={{ pt: 4, pb: 8 }}>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/participant-dashboard')}
          sx={{ mb: 3 }}
        >
          ← Back to Dashboard
        </Button>
        
        {/* Question Section with Scrolling */}
        <Paper elevation={3} sx={{ 
          mb: 4, 
          p: 3, 
          bgcolor: 'background.paper', 
          maxHeight: '200px',
          overflow: 'auto',
          borderRadius: 2
        }}>
          <Typography variant="h5" gutterBottom>
            Challenge {currentChallenge + 1}: {webChallenges[currentChallenge].title}
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {webChallenges[currentChallenge].description}
          </Typography>
          
          <Typography variant="h6" sx={{ mb: 1 }}>Requirements:</Typography>
          <ul>
            {webChallenges[currentChallenge].requirements.map((req, index) => (
              <li key={index}>
                <Typography variant="body2">{req}</Typography>
              </li>
            ))}
          </ul>
          
          {webChallenges[currentChallenge].expectedResultImage && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Expected Result:</Typography>
              <Box 
                component="img"
                src={webChallenges[currentChallenge].expectedResultImage}
                alt="Expected Result Visualization"
                sx={{ 
                  maxWidth: '100%', 
                  maxHeight: '250px', 
                  objectFit: 'contain',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: 1,
                  p: 1,
                  bgcolor: '#fff'
                }}
              />
            </Box>
          )}
        </Paper>
        
        {/* Code Editor - Keep the VS Code styling */}
        <Paper elevation={3} sx={{ 
          mb: 4, 
          overflow: 'hidden',
          borderRadius: 2
        }}>
          {/* Editor Header */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            bgcolor: '#252526', 
            px: 2, 
            py: 1,
            borderBottom: '1px solid #1e1e1e',
            justifyContent: 'space-between'
          }}>
            <Tabs 
              value={editorTab} 
              onChange={handleEditorTabChange}
              sx={{
                minHeight: 'auto',
                '& .MuiTab-root': { 
                  color: 'rgba(255, 255, 255, 0.7)',
                  textTransform: 'none',
                  minHeight: 36,
                  px: 2,
                  '&.Mui-selected': { 
                    color: '#fff',
                    bgcolor: '#1e1e1e'
                  }
                },
                '& .MuiTabs-indicator': { 
                  display: 'none'
                }
              }}
            >
              <Tab label="index.html" />
              <Tab label="styles.css" />
              <Tab label="script.js" />
            </Tabs>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="text" 
                onClick={handleRunCode} 
                size="small"
                sx={{ 
                  color: '#cccccc',
                  minWidth: 'auto',
                  textTransform: 'none',
                  fontSize: 13,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Run
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSubmitChallenge}
                disabled={submitting}
                size="small"
                sx={{
                  backgroundColor: '#0078d4',
                  textTransform: 'none',
                  fontSize: 13,
                  '&:hover': {
                    backgroundColor: '#106ebe'
                  }
                }}
              >
                {submitting ? <CircularProgress size={20} /> : 'Submit'}
              </Button>
            </Box>
          </Box>
          
          {/* Code Editor Body - Keep the same */}
          <Box sx={{ position: 'relative', height: '60vh', bgcolor: '#1e1e1e' }}>
            {/* Line Numbers */}
            <Box 
              sx={{ 
                position: 'absolute', 
                left: 0, 
                top: 0, 
                bottom: 0, 
                width: '40px', 
                bgcolor: '#1e1e1e',
                borderRight: '1px solid #333',
                color: '#858585',
                fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                fontSize: 14,
                lineHeight: 1.5,
                pt: 1,
                textAlign: 'right',
                pr: 1,
                userSelect: 'none'
              }}
            >
              {Array.from({ length: 50 }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </Box>
            
            {/* Editor Content - Keep the same */}
            <Box 
              sx={{ 
                position: 'absolute', 
                left: '40px', 
                top: 0, 
                bottom: 0, 
                right: 0 
              }}
            >
              <TabPanel value={editorTab} index={0} sx={{ height: '100%', m: 0, p: 0 }}>
                <TextField
                  multiline
                  fullWidth
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  variant="standard"
                  sx={{ height: '100%' }}
                  InputProps={{
                    disableUnderline: true,
                    sx: { 
                      fontFamily: '"Consolas", "Monaco", "Courier New", monospace', 
                      height: '100%',
                      fontSize: '14px',
                      color: '#d4d4d4',
                      px: 1,
                      pt: 1,
                      '& textarea': {
                        height: '100% !important',
                        caretColor: '#fff'
                      }
                    }
                  }}
                />
              </TabPanel>
              
              <TabPanel value={editorTab} index={1} sx={{ height: '100%', m: 0, p: 0 }}>
                <TextField
                  multiline
                  fullWidth
                  value={cssCode}
                  onChange={(e) => setCssCode(e.target.value)}
                  variant="standard"
                  sx={{ height: '100%' }}
                  InputProps={{
                    disableUnderline: true,
                    sx: { 
                      fontFamily: '"Consolas", "Monaco", "Courier New", monospace', 
                      height: '100%',
                      fontSize: '14px',
                      color: '#d4d4d4',
                      px: 1,
                      pt: 1,
                      '& textarea': {
                        height: '100% !important',
                        caretColor: '#fff'
                      }
                    }
                  }}
                />
              </TabPanel>
              
              <TabPanel value={editorTab} index={2} sx={{ height: '100%', m: 0, p: 0 }}>
                <TextField
                  multiline
                  fullWidth
                  value={jsCode}
                  onChange={(e) => setJsCode(e.target.value)}
                  variant="standard"
                  sx={{ height: '100%' }}
                  InputProps={{
                    disableUnderline: true,
                    sx: { 
                      fontFamily: '"Consolas", "Monaco", "Courier New", monospace', 
                      height: '100%',
                      fontSize: '14px',
                      color: '#d4d4d4',
                      px: 1,
                      pt: 1,
                      '& textarea': {
                        height: '100% !important',
                        caretColor: '#fff'
                      }
                    }
                  }}
                />
              </TabPanel>
            </Box>
          </Box>
        </Paper>
        
        {/* Preview Section - Keep VS Code styling but match app theme */}
        <Paper elevation={3} sx={{ 
          width: '100%', 
          mb: 4,
          borderRadius: 2,
          overflow: 'hidden'
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: '#252526',
            px: 2,
            py: 1,
          }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 500 }}>
              Preview
            </Typography>
          </Box>
          <Box sx={{ 
            width: '100%',
            height: '400px',
            bgcolor: '#fff',
            overflow: 'hidden'
          }}>
            <iframe 
              id="preview-frame"
              key={previewKey}
              title="Preview" 
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none'
              }}
              srcDoc={`<!DOCTYPE html><html><head></head><body></body></html>`}
            />
          </Box>
        </Paper>
      </Container>
      
      {/* Dialog for completion */}
      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Congratulations!
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            You've completed all Web Development challenges for Round 3! 
            Your submissions will be reviewed by our team.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary" autoFocus>
            Return to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Access disabled alert */}
      <Dialog
        open={isAccessDisabledAlert}
        aria-labelledby="access-revoked-dialog"
      >
        <DialogTitle id="access-revoked-dialog">Round Access Revoked</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Round 3 access has been revoked by the administrator. You will be redirected to the dashboard in 5 seconds.
          </DialogContentText>
        </DialogContent>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Round3Web; 