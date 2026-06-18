[#ftl/]
[#-- @ftlvariable name="application" type="io.fusionauth.domain.Application" --]
[#-- @ftlvariable name="client_id" type="java.lang.String" --]
[#-- @ftlvariable name="showCaptcha" type="boolean" --]
[#-- @ftlvariable name="tenant" type="io.fusionauth.domain.Tenant" --]
[#-- @ftlvariable name="tenantId" type="java.util.UUID" --]
[#import "../_helpers.ftl" as helpers/]

[@helpers.html]
  [@helpers.head]
    [@helpers.captchaScripts showCaptcha=showCaptcha captchaMethod=tenant.captchaConfiguration.captchaMethod siteKey=tenant.captchaConfiguration.siteKey/]
    [#-- Custom <head> code goes here --]
  [/@helpers.head]
  [@helpers.body]
    [@helpers.header]
      [#-- Custom header code goes here --]
    [/@helpers.header]

    [@helpers.main title=theme.message('forgot-password-title')]
      <form action="${request.contextPath}/password/forgot" method="POST" class="full">
        [@helpers.oauthHiddenFields/]

        <p>
          ${theme.message('forgot-password')}
        </p>
        <fieldset class="push-less-top">
          [@helpers.input type="text" name="loginId" id="loginId" autocapitalize="none" autofocus=true autocomplete="on" autocorrect="off" placeholder=theme.message('loginId') leftAddon="user" required=true/]
          [@helpers.captchaBadge showCaptcha=showCaptcha captchaMethod=tenant.captchaConfiguration.captchaMethod siteKey=tenant.captchaConfiguration.siteKey/]
        </fieldset>
        <div class="form-row flex justify-center flex-col gap-2">
          [@helpers.button text=theme.message('submit')/]
          [#if (redirect_uri!'')?has_content]
            <p class="mt-2 w-full text-center">[@helpers.link url="/oauth2/authorize"]${theme.message('return-to-login')}[/@helpers.link]</p>
          [#elseif (request.queryString!'')?has_content]
            <p class="mt-2 w-full text-center"><a href="${request.contextPath}/oauth2/authorize?${request.queryString}">${theme.message('return-to-login')}</a></p>
          [#elseif (client_id!'')?has_content && (application.oauthConfiguration.authorizedRedirectURLs![])?size gt 0]
            <p class="mt-2 w-full text-center"><a href="${request.contextPath}/oauth2/authorize?tenantId=${(tenantId)!''}&client_id=${(client_id)!''}&redirect_uri=${(application.oauthConfiguration.authorizedRedirectURLs[0])?url}&response_type=code&scope=openid">${theme.message('return-to-login')}</a></p>
          [#else]
            <p class="mt-2 w-full text-center"><a href="${request.contextPath}/oauth2/authorize">${theme.message('return-to-login')}</a></p>
          [/#if]
        </div>
      </form>
    [/@helpers.main]

    [@helpers.footer]
      [#-- Custom footer code goes here --]
    [/@helpers.footer]
  [/@helpers.body]
[/@helpers.html]
