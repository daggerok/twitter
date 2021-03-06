package daggerok.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/react")
public class ReactPage {

  @GetMapping
  public String redirect(Object obj) {
    return "redirect:/react/";
  }

  @GetMapping({ "/", "/rx", "/some" })
  public String home() {
    return "/react/index.html";
  }
}
