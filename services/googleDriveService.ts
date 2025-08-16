// --- Mock Google Drive Service ---
// This is a mock service to simulate Google Drive API interactions for UI development.
// In a real application, this would use the Google Drive API (gapi).

const MOCK_DELAY = 1500; // Simulate network latency

let isSignedIn = false;
let mockUser = { name: "Demo User", email: "demo.user@google.com" };
let mockDriveData: string | null = null;

// Simulate signing in to Google
export const signIn = async (): Promise<{ name: string; email: string }> => {
  await new Promise(res => setTimeout(res, MOCK_DELAY));
  if (Math.random() > 0.95) { // Simulate rare login failure
    throw new Error("Mock sign-in failed. Please try again.");
  }
  isSignedIn = true;
  return mockUser;
};

// Simulate signing out
export const signOut = async (): Promise<void> => {
  await new Promise(res => setTimeout(res, 500));
  isSignedIn = false;
};

// Simulate checking initial sign-in status
export const checkSignInStatus = async (): Promise<{ isSignedIn: boolean; user?: { name: string; email: string } }> => {
    // In a real app, gapi.auth2.getAuthInstance().isSignedIn.get() would be used.
    // Here we just return the mock state.
    await new Promise(res => setTimeout(res, 200));
    return { isSignedIn, user: isSignedIn ? mockUser : undefined };
};


// Simulate uploading data to a file in Google Drive
export const uploadData = async (data: object): Promise<{ id: string; name: string }> => {
  if (!isSignedIn) throw new Error("Not signed in.");
  await new Promise(res => setTimeout(res, MOCK_DELAY));
  
  mockDriveData = JSON.stringify(data);
  console.log("Mock data uploaded to Drive:", mockDriveData);
  
  return { id: "mock_file_id_12345", name: "veggielog_backup.json" };
};

// Simulate downloading data from a file in Google Drive
export const downloadData = async (): Promise<object | null> => {
  if (!isSignedIn) throw new Error("Not signed in.");
  await new Promise(res => setTimeout(res, MOCK_DELAY));

  if (!mockDriveData) {
    // Simulate case where no backup file is found
    console.log("Mock backup file not found in Drive.");
    return null;
  }
  
  console.log("Mock data downloaded from Drive:", mockDriveData);
  return JSON.parse(mockDriveData);
};
