import { createFileRoute } from "@tanstack/react-router";
import { FlappyGame } from "@/components/FlappyGame";

export const Route = createFileRoute("/")({
  component: () => <FlappyGame />,
});
