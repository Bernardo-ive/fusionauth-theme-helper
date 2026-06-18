[#ftl/]
[#-- @ftlvariable name="application" type="io.fusionauth.domain.Application" --]
[#-- @ftlvariable name="client_id" type="java.lang.String" --]
[#-- @ftlvariable name="loginId" type="java.lang.String" --]
[#-- @ftlvariable name="tenant" type="io.fusionauth.domain.Tenant" --]
[#-- @ftlvariable name="tenantId" type="java.util.UUID" --]
[#import "../_helpers.ftl" as helpers/]

[@helpers.html]
  [@helpers.head]
    [#-- Custom <head> code goes here --]
  [/@helpers.head]
  [@helpers.body]
    [@helpers.header]
      [#-- Custom header code goes here --]
    [/@helpers.header]

    [@helpers.main title=theme.message('forgot-password-message-sent-title')]
      <p>
        ${theme.message('forgot-password-message-sent', loginId)}
      </p>
      [#if (redirect_uri!'')?has_content]
        <p class="mt-2">[@helpers.link url="/oauth2/authorize"]${theme.message('return-to-login')}[/@helpers.link]</p>
      [#elseif (request.queryString!'')?has_content]
        <p class="mt-2"><a href="${request.contextPath}/oauth2/authorize?${request.queryString}">${theme.message('return-to-login')}</a></p>
      [#elseif (client_id!'')?has_content && (application.oauthConfiguration.authorizedRedirectURLs![])?size gt 0]
        <p class="mt-2"><a href="${request.contextPath}/oauth2/authorize?tenantId=${(tenantId)!''}&client_id=${(client_id)!''}&redirect_uri=${(application.oauthConfiguration.authorizedRedirectURLs[0])?url}&response_type=code&scope=openid">${theme.message('return-to-login')}</a></p>
      [#else]
        <p class="mt-2"><a href="${request.contextPath}/oauth2/authorize">${theme.message('return-to-login')}</a></p>
      [/#if]
    [/@helpers.main]

    [@helpers.footer]
      [#-- Custom footer code goes here --]
    [/@helpers.footer]
  [/@helpers.body]
[/@helpers.html]
