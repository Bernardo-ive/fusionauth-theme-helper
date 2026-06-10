package com.iveone.emailpreview;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import freemarker.cache.StringTemplateLoader;
import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import freemarker.template.TemplateExceptionHandler;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.StringWriter;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public final class Main {
  private static final ObjectMapper MAPPER = new ObjectMapper()
      .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private static final Configuration FM = buildFreemarkerConfig();

  public static void main(String[] args) throws Exception {
    int port = 4561;
    String envPort = System.getenv("EMAIL_PREVIEW_FM_PORT");
    if (envPort != null && !envPort.isBlank()) {
      try {
        port = Integer.parseInt(envPort);
      } catch (NumberFormatException ignored) {
        // keep default
      }
    }

    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/api/health", new HealthHandler());
    server.createContext("/api/render", new RenderHandler());
    server.setExecutor(null);
    server.start();

    System.out.println("email-preview (freemarker) running on http://localhost:" + port);
  }

  private static Configuration buildFreemarkerConfig() {
    Configuration cfg = new Configuration(Configuration.VERSION_2_3_34);
    cfg.setDefaultEncoding("UTF-8");
    cfg.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
    cfg.setLogTemplateExceptions(false);
    cfg.setWrapUncheckedExceptions(true);
    cfg.setFallbackOnNullLoopVariable(false);
    // Templates are provided per-request via StringTemplateLoader.
    cfg.setTemplateLoader(new StringTemplateLoader());
    return cfg;
  }

  private static byte[] readAllBytes(InputStream is) throws IOException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    byte[] buf = new byte[8192];
    int n;
    while ((n = is.read(buf)) >= 0) {
      baos.write(buf, 0, n);
    }
    return baos.toByteArray();
  }

  private static void json(HttpExchange ex, int status, Object body) throws IOException {
    byte[] bytes = MAPPER.writeValueAsBytes(body);
    Headers h = ex.getResponseHeaders();
    h.set("Content-Type", "application/json; charset=utf-8");
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    ex.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = ex.getResponseBody()) {
      os.write(bytes);
    }
  }

  private static final class HealthHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange ex) throws IOException {
      if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
        json(ex, 405, Map.of("error", "Method not allowed"));
        return;
      }
      json(ex, 200, Map.of("ok", true));
    }
  }

  private static final class RenderHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange ex) throws IOException {
      if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) {
        Headers h = ex.getResponseHeaders();
        h.set("Access-Control-Allow-Origin", "*");
        h.set("Access-Control-Allow-Headers", "Content-Type");
        h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        ex.sendResponseHeaders(204, -1);
        return;
      }

      if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
        json(ex, 405, Map.of("error", "Method not allowed"));
        return;
      }

      byte[] bodyBytes = readAllBytes(ex.getRequestBody());
      Map<String, Object> req;
      try {
        req = MAPPER.readValue(bodyBytes, new TypeReference<Map<String, Object>>() {});
      } catch (Exception e) {
        json(ex, 400, Map.of("error", "Invalid JSON", "details", e.getMessage()));
        return;
      }

      String html = asString(req.get("html"));
      String text = asString(req.get("text"));
      Object ctxObj = req.get("context");
      Map<String, Object> ctx = ctxObj instanceof Map ? (Map<String, Object>) ctxObj : new HashMap<>();

      try {
        String renderedHtml = render("html", html, ctx);
        String renderedText = render("text", text, ctx);
        json(ex, 200, Map.of(
            "html", renderedHtml,
            "text", renderedText,
            "errors", Map.of()
        ));
      } catch (TemplateException te) {
        json(ex, 200, Map.of(
            "html", "",
            "text", "",
            "errors", Map.of("freemarker", te.getMessage())
        ));
      } catch (Exception e) {
        json(ex, 500, Map.of("error", "Render failed", "details", e.getMessage()));
      }
    }

    private static String asString(Object v) {
      if (v == null) return "";
      return String.valueOf(v);
    }

    private static String render(String name, String source, Map<String, Object> ctx) throws IOException, TemplateException {
      StringTemplateLoader loader = new StringTemplateLoader();
      loader.putTemplate(name, source == null ? "" : source);

      Configuration cfg = new Configuration(Configuration.VERSION_2_3_34);
      cfg.setDefaultEncoding("UTF-8");
      cfg.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
      cfg.setLogTemplateExceptions(false);
      cfg.setWrapUncheckedExceptions(true);
      cfg.setFallbackOnNullLoopVariable(false);
      cfg.setTemplateLoader(loader);

      Template tpl = cfg.getTemplate(name);
      StringWriter sw = new StringWriter();
      tpl.process(ctx, sw);
      return sw.toString();
    }
  }
}
