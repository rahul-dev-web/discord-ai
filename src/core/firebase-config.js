/**
 * FIREBASE CONFIGURATION
 * Handles Firebase initialization and database operations
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, update, remove, push } = require('firebase/database');
const Logger = require('../utils/logger');

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

let firebaseApp = null;
let database = null;

/**
 * Initialize Firebase
 */
function initializeFirebase() {
  if (firebaseApp) {
    Logger.info('Firebase already initialized');
    return firebaseApp;
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
    Logger.success('Firebase initialized successfully!');
    return firebaseApp;
  } catch (error) {
    Logger.error('Firebase initialization failed:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabaseInstance() {
  if (!database) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return database;
}

/**
 * Wrapper functions for common operations
 */
const firebaseOperations = {
  /**
   * Set data at a path
   */
  async set(path, data) {
    try {
      const db = getDatabaseInstance();
      const reference = ref(db, path);
      await set(reference, data);
      return true;
    } catch (error) {
      Logger.error(`Firebase set error at ${path}:`, error);
      return false;
    }
  },

  /**
   * Get data from a path
   */
  async get(path) {
    try {
      const db = getDatabaseInstance();
      const reference = ref(db, path);
      const snapshot = await get(reference);
      return snapshot.val();
    } catch (error) {
      Logger.error(`Firebase get error at ${path}:`, error);
      return null;
    }
  },

  /**
   * Update data at a path
   */
  async update(path, updates) {
    try {
      const db = getDatabaseInstance();
      const reference = ref(db, path);
      await update(reference, updates);
      return true;
    } catch (error) {
      Logger.error(`Firebase update error at ${path}:`, error);
      return false;
    }
  },

  /**
   * Remove data from a path
   */
  async remove(path) {
    try {
      const db = getDatabaseInstance();
      const reference = ref(db, path);
      await remove(reference);
      return true;
    } catch (error) {
      Logger.error(`Firebase remove error at ${path}:`, error);
      return false;
    }
  },

  /**
   * Push new child to a path
   */
  async push(path, data) {
    try {
      const db = getDatabaseInstance();
      const reference = ref(db, path);
      const newRef = push(reference, data);
      return newRef.key;
    } catch (error) {
      Logger.error(`Firebase push error at ${path}:`, error);
      return null;
    }
  },
};

module.exports = {
  initializeFirebase,
  getDatabase: getDatabaseInstance,
  ...firebaseOperations,
};
