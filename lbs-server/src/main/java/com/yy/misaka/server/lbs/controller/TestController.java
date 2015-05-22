package com.yy.misaka.server.lbs.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
public class TestController {

    protected Logger logger = LoggerFactory.getLogger(this.getClass());

    @ExceptionHandler(Exception.class)
    public void exception(Exception e) {
        logger.error("test exception ", e);
    }

    @RequestMapping(value = "/echo", method = { RequestMethod.POST, RequestMethod.GET })
    @ResponseBody
    public String test(@RequestParam(required = false, defaultValue = "EMPTY") String data, @RequestParam(required = false) String appId) {
        logger.info("data {}, appId {}", data, appId);
        return data;
    }

    @RequestMapping(value = "/echo2", method = { RequestMethod.POST, RequestMethod.GET })
    @ResponseBody
    public String echo2(@RequestBody String data) {
        logger.info("echo2 data {}", data);
        return data;
    }


}