# **App Name**: Bug Tracker Pro

## Core Features:

- Bug Submission Form: Form to submit bug reports with fields for Bug ID, Title, Bug URL, Description, Assigned Developer, Tester ID, Resolution, Comment Session, Created At, Updated At, Priority, and Bug Status.
- Bug Management API: REST APIs to manage bugs: POST (add new), GET (all bugs, bug by ID), PUT (update), DELETE (delete).
- Bug Data Storage: MySQL database to store bug reports with columns for all relevant fields, including ENUM types for priority and status.

## Style Guidelines:

- Primary color: Light gray (#f5f5f5) for background.
- Secondary color: Dark gray (#333) for text and labels.
- Accent: Teal (#008080) for buttons and interactive elements.
- Clean and organized layout with clear sections for form inputs and data display.
- Use meaningful icons to represent bug status and priority levels.

## Original User Request:
Create a Bug Tracking System using:
Frontend: React.js
Backend: Node.js + Express
Database: MySQL
The frontend form should have the following fields:
Bug ID (text input)
Title (text input)
Bug URL (text input)
Description (multiline text area)
Assigned Developer (dropdown select)
Tester ID (text input)
Resolution (multiline text area)
Comment Session (multiline text area)
Created At (date picker)
Updated At (date picker)
Priority (dropdown select with options: Low, Medium, High)
Bug Status (dropdown select with options: Open, In Progress, Resolved, Closed)
Add a Submit Bug button to submit the form data.
Backend (Node.js/Express):
Set up REST APIs to:
POST /bugs → Add a new bug
GET /bugs → Get all bugs
GET /bugs/:id → Get a bug by ID
PUT /bugs/:id → Update a bug
DELETE /bugs/:id → Delete a bug
Use Sequelize ORM (or raw SQL queries) to interact with MySQL database.
Database (MySQL):
Create a bugs table with columns:
id (Primary Key, Auto Increment)
bugId (String)
title (String)
bugUrl (String)
description (Text)
assignedDeveloper (String)
testerId (String)
resolution (Text)
commentSession (Text)
createdAt (Date)
updatedAt (Date)
priority (ENUM: Low, Medium, High)
bugStatus (ENUM: Open, In Progress, Resolved, Closed)
  