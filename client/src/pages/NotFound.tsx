import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";
import { useAudit } from "@/contexts/AuditContext";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { theme } = useAudit();

  return (
    <main className={`not-found-shell not-found-shell--${theme}`} aria-labelledby="not-found-title">
      <Card className="not-found-card">
        <CardContent className="not-found-content">
          <div className="not-found-icon" aria-hidden="true">
            <AlertCircle className="h-14 w-14" />
          </div>
          <p className="not-found-code">404</p>
          <h1 id="not-found-title">Страница не найдена</h1>
          <p className="not-found-copy">
            Такой страницы нет или она была перемещена.
            <br />
            Вернитесь в сводку и продолжите работу с доступным разделом.
          </p>
          <div id="not-found-button-group" className="not-found-actions">
            <Button type="button" onClick={() => setLocation("/")} className="not-found-home-action">
              <Home className="w-4 h-4" />
              На главную
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
