package com.Panelinformativo.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Redirigir todas las rutas no-API al index.html para SPA routing
        registry.addViewController("/").setViewName("forward:/index.html");
        registry.addViewController("/login").setViewName("forward:/index.html");
        registry.addViewController("/admin").setViewName("forward:/index.html");
        registry.addViewController("/deposito").setViewName("forward:/index.html");
        registry.addViewController("/pantalla").setViewName("forward:/index.html");
        registry.addViewController("/pantalla-publica").setViewName("forward:/index.html");
        registry.addViewController("/registro-primer-admin").setViewName("forward:/index.html");
    }
}

