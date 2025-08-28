import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RootLayout from "@/root-layout";
import { SessionContainer } from "@/containers/session-container";
import HomePage from "@/pages/home-page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "sessions/:id",
        element: <SessionContainer />,
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}