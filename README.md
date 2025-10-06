# USD Gateway (Firebase Studio)

This is a Next.js starter project built within Firebase Studio. It serves as a plug-and-play gateway for USD-denominated events, built for sovr.world. The application is bootstrapped with Next.js, TypeScript, and Tailwind CSS, and integrates with Genkit for AI-powered features.

## Project Overview

The primary goal of this application is to provide a simple and robust interface for handling financial transactions or events denominated in USD. It features a modern tech stack designed for performance, developer experience, and scalability.

- **Frontend:** Next.js (React) with TypeScript
- **Styling:** Tailwind CSS with `shadcn/ui` for component primitives.
- **AI:** Google's Genkit for integrating generative AI models and flows.
- **Backend Services:** Firebase for features like authentication and database.
- **Payments/Web3:** Integrations with Stripe and Web3.js.

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing.

### Prerequisites

- Node.js (v20.x or later recommended)
- npm (v10.x or later) or yarn
- A Firebase project set up. You will need your project configuration keys.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <project-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project and add your Firebase and other service credentials.

    ```.env.local
    # Firebase Config
    NEXT_PUBLIC_FIREBASE_API_KEY=...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=...

    # Stripe
    STRIPE_SECRET_KEY=...
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

    # Other services
    ...
    ```

### Running the Development Server

To run the Next.js frontend application:

```bash
npm run dev
```

This will start the development server on `http://localhost:9002`.

To run the Genkit AI flows in development mode:

```bash
npm run genkit:dev
```

## Available Scripts

This project includes several scripts to help with development and maintenance:

- `npm run dev`: Starts the Next.js development server with Turbopack.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs the linter to check for code quality issues.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.
- `npm run test`: Executes the test suite using Jest.
- `npm run genkit:dev`: Starts the Genkit development server.
- `npm run genkit:watch`: Starts the Genkit server with file watching enabled.

## Project Structure

- `src/app/`: Main application code, following the Next.js App Router structure.
- `src/app/page.tsx`: The entry point and main page of the application.
- `src/components/`: Shared React components.
- `src/ai/`: Houses all Genkit-related AI flows and configurations.
- `public/`: Static assets like images and fonts.

## Audit & Recommendations

An audit of the project was conducted with the following recommendations for improvement:

1.  **Update Next.js to a Stable Version:** The project currently uses `next: "15.3.3"`, which is a pre-release version. It is strongly recommended to downgrade to the latest stable version (e.g., `^14.2.0`) for production builds to ensure stability.

2.  **Clean Up `package.json`:** The `scripts` section contains a duplicate `typecheck` command. This should be removed.

3.  **Establish a Comprehensive Testing Strategy:**
    - **Unit Tests:** Write unit tests for individual components and utility functions using Jest and React Testing Library. Focus on testing component rendering, props, and user interactions.
    - **Integration Tests:** Create tests for user flows that involve multiple components, such as the entire checkout process.
    - **E2E Tests:** Consider adding end-to-end tests with a framework like Cypress or Playwright to simulate real user journeys and catch issues in a production-like environment.

4.  **Dependency Management:**
    - Periodically run `npm audit` to check for security vulnerabilities in dependencies.
    - Investigate the source of the deprecated `request` package and work towards removing it by updating the parent dependency.

## Contributing

Contributions are welcome! Please open an issue to discuss any major changes before submitting a pull request. Ensure that all new code is covered by tests and that the linter passes.