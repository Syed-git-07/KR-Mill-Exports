import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const modules = [
    {
      title: "Masters",
      description: "Manage all master data including departments, machines, supervisors, and configurations",
      href: "/masters",
      icon: "⚙️",
      status: "Ready"
    },
    {
      title: "Preparatory Master",
      description: "Carding, Drawing, Comber, Simplex and other preparatory machine masters",
      href: "/preparatory-master",
      icon: "🏭",
      status: "Ready"
    },
    {
      title: "Preparatory Entry",
      description: "Daily production entry for Carding, Drawing, Comber, Simplex and other preparatory machines",
      href: "/preparatory-entry",
      icon: "📝",
      status: "Ready"
    },
    {
      title: "Post Preparatory Entry",
      description: "Daily production entry for Spinning (Ring Frame) and other post-preparatory machines",
      href: "/post-preparatory",
      icon: "🧵",
      status: "Ready"
    },
    {
      title: "Reports",
      description: "Production reports and analytics",
      href: "/reports",
      icon: "📈",
      status: "Ready"
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Welcome to KR Production System</h1>
        <p className="text-muted-foreground">
          Select a module below to get started
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {modules.map((module) => (
          <Card key={module.title} className="hover:shadow-xl transition-all hover:scale-105 border-2">
            <CardHeader className="text-center">
              <div className="text-5xl mb-3">{module.icon}</div>
              <CardTitle className="text-xl">{module.title}</CardTitle>
              <CardDescription className="text-sm">{module.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {module.status === "Ready" ? (
                <Link href={module.href}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                    Open Module
                  </Button>
                </Link>
              ) : (
                <Button disabled variant="outline" className="w-full">
                  {module.status}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
