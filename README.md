<<<<<<< HEAD
# Slottic

Cafe & Workshop Slot Booking Platform
echo -e "# Slottic\n\nCafe & Workshop Slot Booking Platform" > README.md

## Core Features

- **User Authentication**: Secure sign-up and login.
- **Role-Based Access**: Distinct roles for different user types.
- **Bug Management**: Create, view, update, and delete bug reports.
- **Real-time Updates**: Utilizes Firebase for real-time data synchronization.

## Tech Stack

- **Frontend**: Next.js (React)
- **Styling**: Tailwind CSS & shadcn/ui
- **Backend & Database**: Firebase (Authentication, Firestore, Storage)

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- Firebase Account & Project

### Installation & Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set up Firebase Environment Variables:**
    - Create a `.env` file in the project root.
    - Add your Firebase project configuration keys to this file (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, etc.).

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Deploy to Firebase:**
    ```bash
    firebase deploy
    ```

## Testing the Application

To test the application, you can follow these user flows:

### 1. User Signup

- **Cafe Manager**:
    1.  Navigate to the [signup page](/signup).
    2.  Fill in your details and select the "Cafe Manager" role.
    3.  Enter a name for your cafe.
    4.  Click "Sign Up".
    5.  After signup, you will be redirected to the login page.

- **Event Organizer**:
    1.  Navigate to the [signup page](/signup).
    2.  Fill in your details and select the "Organizer" role.
    3.  Enter a name for your organization.
    4.  Click "Sign Up".
    5.  You will be redirected to the login page.

### 2. User Login

1.  Navigate to the [login page](/login).
2.  Enter the credentials you used during signup.
3.  Upon successful login, you will be redirected to your dashboard.
    - Cafe Managers will see their specific dashboard.
    - Organizers will see theirs.

### 3. Forgot Password

1.  From the [login page](/login), click the "Forgot Password?" link.
2.  Enter the email address you used to sign up.
3.  Click "Send Reset Link".
4.  Check your email inbox (and spam folder) for a password reset link.
=======
# slottic
>>>>>>> 6aa95c2102a03de44c12ebb0d54251e2a546a0e4
